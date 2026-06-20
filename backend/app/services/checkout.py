"""Razorpay checkout and fulfillment."""

from __future__ import annotations

import logging
import os
import uuid
import zipfile
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path

import httpx
import razorpay
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.models.listing import Listing
from app.models.transaction import Transaction
from app.models.user import User


logger = logging.getLogger(__name__)


def get_razorpay_client() -> razorpay.Client | None:
    settings = get_settings()
    if settings.razorpay_key_id and settings.razorpay_key_secret:
        return razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
    return None


async def create_razorpay_order(
    db: AsyncSession,
    user: User,
    listing_id: uuid.UUID,
) -> tuple[str, Transaction]:
    settings = get_settings()
    client = get_razorpay_client()

    result = await db.execute(select(Listing).where(Listing.id == listing_id, Listing.status == "active"))
    listing = result.scalar_one_or_none()
    if not listing:
        raise ValueError("Listing not available")

    transaction = Transaction(
        user_id=user.id,
        listing_id=listing.id,
        amount_cents=listing.price_cents,
        status="pending",
        fulfillment_status="pending",
    )
    db.add(transaction)
    await db.flush()

    if not client:
        # Dev mode without Razorpay — mark pending, client confirms via dev endpoint
        transaction.razorpay_order_id = f"dev_{transaction.id}"
        await db.flush()
        return (
            transaction.razorpay_order_id,
            transaction,
        )

    # Razorpay expects amount in the smallest currency unit (e.g. paise for INR)
    # Our price_cents is already the smallest unit
    order_data = {
        "amount": listing.price_cents,
        "currency": settings.razorpay_currency,
        "receipt": str(transaction.id),
        "notes": {
            "listing_id": str(listing.id),
            "user_id": str(user.id),
        }
    }
    
    # create order requires synchronous call; it's fine for simple use cases or we can wrap it
    try:
        order = client.order.create(data=order_data)
        transaction.razorpay_order_id = order["id"]
        await db.flush()
        return order["id"], transaction
    except Exception as exc:
        logger.error("Failed to create razorpay order: %s", exc)
        raise ValueError("Failed to create payment order")


async def verify_razorpay_payment(db: AsyncSession, order_id: str, payment_id: str, signature: str) -> None:
    client = get_razorpay_client()
    if not client:
        raise ValueError("Razorpay not configured")

    try:
        client.utility.verify_payment_signature({
            'razorpay_order_id': order_id,
            'razorpay_payment_id': payment_id,
            'razorpay_signature': signature
        })
    except Exception as exc:
        raise ValueError("Invalid signature") from exc

    result = await db.execute(
        select(Transaction)
        .where(Transaction.razorpay_order_id == order_id)
        .options(selectinload(Transaction.listing), selectinload(Transaction.user))
    )
    transaction = result.scalar_one_or_none()
    
    if not transaction or transaction.status == "succeeded":
        return

    transaction.status = "succeeded"
    transaction.escrow_status = "held"
    transaction.razorpay_payment_id = payment_id
    if transaction.listing:
        transaction.listing.status = "sold"
    
    await db.flush()


async def handle_razorpay_webhook(db: AsyncSession, payload: dict) -> None:
    # Webhook processing logic can go here if we want to support delayed async webhooks.
    # Currently we rely on verify_razorpay_payment called directly from frontend callback.
    event = payload.get("event")
    if event == "order.paid":
        order_entity = payload.get("payload", {}).get("order", {}).get("entity", {})
        payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        order_id = order_entity.get("id")
        payment_id = payment_entity.get("id")
        
        if not order_id:
            return
            
        result = await db.execute(
            select(Transaction)
            .where(Transaction.razorpay_order_id == order_id)
            .options(selectinload(Transaction.listing), selectinload(Transaction.user))
        )
        transaction = result.scalar_one_or_none()
        if not transaction or transaction.status == "succeeded":
            return

        transaction.status = "succeeded"
        transaction.escrow_status = "held"
        transaction.razorpay_payment_id = payment_id
        if transaction.listing:
            transaction.listing.status = "sold"
        
        await db.flush()


