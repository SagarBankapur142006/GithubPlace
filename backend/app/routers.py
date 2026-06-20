"""FastAPI route handlers."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    clear_auth_cookie,
    create_access_token,
    get_current_user,
    get_optional_user,
    hash_password,
    hash_password_async,
    set_auth_cookie,
    verify_password,
    verify_password_async,
)
from app.database import get_db
from app.models.listing import Listing
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas import (
    CheckoutSessionRequest,
    RazorpayOrderResponse,
    RazorpayVerifyRequest,
    ListingDetail,
    ListingSummary,
    ListingsResponse,
    ScoutTriggerResponse,
    SignInRequest,
    SignUpRequest,
    TransactionResponse,
    UserResponse,
    EvaluateRequest,
    ExtensionEvaluateRequest,
    PublishListingRequest,
)
from app.search import listing_matches_terms, preprocess_query
from app.services.checkout import create_razorpay_order, handle_razorpay_webhook, verify_razorpay_payment

router = APIRouter()


@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(select(func.count()).select_from(Listing))
        return {"status": "ok", "service": "ideora-api"}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/auth/signup", response_model=UserResponse)
async def signup(body: SignUpRequest, response: Response, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email.lower(),
        password_hash=await hash_password_async(body.password),
        full_name=body.full_name,
    )
    db.add(user)
    await db.flush()

    token = create_access_token(user.id)
    set_auth_cookie(response, token)
    await db.commit()
    return user


@router.post("/auth/signin", response_model=UserResponse)
async def signin(body: SignInRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()
    if not user or not await verify_password_async(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.id)
    set_auth_cookie(response, token)
    await db.commit()
    return user


@router.post("/auth/signout")
async def signout(response: Response):
    clear_auth_cookie(response)
    return {"ok": True}


@router.get("/auth/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user


@router.get("/listings", response_model=ListingsResponse)
async def list_listings(
    q: str | None = None,
    category: str | None = None,
    min_price: int | None = None,
    max_price: int | None = None,
    complexity: str | None = None,
    exact_title: str | None = None,
    limit: int | None = None,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    query_stmt = select(Listing).where(Listing.status == "active")

    # Exclude the logged-in user's own listings from the marketplace
    if current_user:
        query_stmt = query_stmt.where(Listing.seller_id != current_user.id)

    if category:
        query_stmt = query_stmt.where(Listing.category.ilike(f"%{category}%"))
    if min_price is not None:
        query_stmt = query_stmt.where(Listing.price_cents >= min_price)
    if max_price is not None:
        query_stmt = query_stmt.where(Listing.price_cents <= max_price)
    if complexity:
        query_stmt = query_stmt.where(Listing.complexity == complexity)

    result = await db.execute(query_stmt.order_by(Listing.growth_potential_score.desc()))
    listings = list(result.scalars().all())

    suggested_query = None
    if exact_title:
        listings = [l for l in listings if l.title.lower() == exact_title.lower()]
    elif q and len(q) >= 2:
        terms, suggested_query, _ = preprocess_query(q)
        listings = [l for l in listings if listing_matches_terms(l, terms)]

    if limit is not None:
        listings = listings[:limit]

    return ListingsResponse(
        items=[ListingSummary.model_validate(l) for l in listings],
        total=len(listings),
        query=q,
        suggested_query=suggested_query,
    )


@router.get("/listings/autocomplete")
async def autocomplete(q: str, db: AsyncSession = Depends(get_db)):
    if len(q) < 2:
        return {"items": []}

    result = await db.execute(
        select(Listing)
        .where(Listing.status == "active")
        .where(Listing.title.ilike(f"%{q}%") | Listing.category.ilike(f"%{q}%"))
        .limit(15)
    )
    listings = result.scalars().all()
    return {
        "items": [{"title": l.title, "category": l.category, "slug": l.slug} for l in listings]
    }


@router.get("/listings/stats")
async def listing_stats(db: AsyncSession = Depends(get_db)):
    count_result = await db.execute(select(func.count()).select_from(Listing).where(Listing.status == "active"))
    count = count_result.scalar() or 0
    price_result = await db.execute(
        select(func.sum(Listing.price_cents)).where(Listing.status.in_(["active", "sold"]))
    )
    total_cents = price_result.scalar() or 0
    return {
        "active_listings": count,
        "total_volume_cents": total_cents,
    }


@router.get("/listings/{slug}", response_model=ListingDetail)
async def get_listing(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Listing).where(Listing.slug == slug))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return ListingDetail.model_validate(listing)


@router.get("/listings/{slug}/related")
async def related_listings(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Listing).where(Listing.slug == slug))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    related_result = await db.execute(
        select(Listing)
        .where(Listing.status == "active")
        .where(Listing.category == listing.category)
        .where(Listing.id != listing.id)
        .limit(6)
    )
    related = related_result.scalars().all()
    return {"categories": list({l.category for l in related}), "items": [ListingSummary.model_validate(l) for l in related]}


@router.post("/checkout/create-order", response_model=RazorpayOrderResponse)
async def checkout_create_order(
    body: CheckoutSessionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.config import get_settings
    settings = get_settings()
    try:
        order_id, transaction = await create_razorpay_order(db, user, body.listing_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await db.commit()
    return RazorpayOrderResponse(
        order_id=order_id,
        amount=transaction.amount_cents,
        currency=settings.razorpay_currency,
        transaction_id=transaction.id
    )

@router.post("/checkout/verify")
async def verify_payment(
    body: RazorpayVerifyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await verify_razorpay_payment(
            db,
            order_id=body.razorpay_order_id,
            payment_id=body.razorpay_payment_id,
            signature=body.razorpay_signature
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await db.commit()
    return {"ok": True}

@router.post("/checkout/webhook")
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    from app.config import get_settings
    import hmac
    import hashlib

    settings = get_settings()
    payload = await request.body()
    sig_header = request.headers.get("x-razorpay-signature", "")

    if not settings.razorpay_webhook_secret:
        raise HTTPException(status_code=400, detail="Webhook not configured")

    expected_sig = hmac.new(
        bytes(settings.razorpay_webhook_secret, "latin-1"),
        msg=payload,
        digestmod=hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_sig, sig_header):
        raise HTTPException(status_code=400, detail="Invalid signature")

    import json
    try:
        event = json.loads(payload)
        await handle_razorpay_webhook(db, event)
        await db.commit()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"received": True}


@router.get("/transactions/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == user.id))
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    listing_result = await db.execute(select(Listing).where(Listing.id == transaction.listing_id))
    listing = listing_result.scalar_one_or_none()

    from app.models.fulfillment import FulfillmentAsset

    assets_result = await db.execute(
        select(FulfillmentAsset).where(FulfillmentAsset.transaction_id == transaction.id)
    )
    assets = assets_result.scalars().all()

    return TransactionResponse(
        id=transaction.id,
        status=transaction.status,
        fulfillment_status=transaction.fulfillment_status,
        amount_cents=transaction.amount_cents,
        listing=ListingSummary.model_validate(listing) if listing else None,
        fulfillment_assets=[
            {
                "delivery_method": a.delivery_method,
                "delivery_url_or_reference": a.delivery_url_or_reference,
                "expires_at": a.expires_at.isoformat() if a.expires_at else None,
            }
            for a in assets
        ],
    )


@router.get("/transactions/{transaction_id}/download")
async def download_fulfillment(
    transaction_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == user.id)
    )
    transaction = result.scalar_one_or_none()
    if not transaction or transaction.fulfillment_status != "delivered":
        raise HTTPException(status_code=404, detail="Package not available")

    from app.models.fulfillment import FulfillmentAsset

    assets_result = await db.execute(
        select(FulfillmentAsset).where(FulfillmentAsset.transaction_id == transaction.id)
    )
    asset = assets_result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="No fulfillment asset")

    path = Path(asset.delivery_url_or_reference)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Package file missing")

    return FileResponse(path, filename=f"ideora-acquisition-{transaction_id}.zip", media_type="application/zip")


@router.post("/checkout/dev-confirm/{transaction_id}")
async def dev_confirm_checkout(
    transaction_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dev-only: simulate successful payment when Stripe is not configured."""
    from app.config import get_settings
    from app.services.checkout import fulfill_transaction

    if get_settings().stripe_secret_key:
        raise HTTPException(status_code=404, detail="Not available")

    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == user.id)
    )
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if transaction.status != "succeeded":
        transaction.status = "succeeded"
        listing_result = await db.execute(select(Listing).where(Listing.id == transaction.listing_id))
        listing = listing_result.scalar_one_or_none()
        if listing:
            listing.status = "sold"
        await db.flush()
        await fulfill_transaction(db, transaction)

    await db.commit()
    return {"ok": True}
@router.post("/seller/evaluate")
async def seller_evaluate(body: EvaluateRequest, user: User = Depends(get_current_user)):
    from app.services.ai_evaluator import evaluate_readme
    pitch_deck = await evaluate_readme(body.readme_text)
    return {"pitch_deck": pitch_deck}

@router.post("/extension/evaluate")
async def extension_evaluate(body: ExtensionEvaluateRequest):
    from app.services.ai_evaluator import evaluate_readme
    pitch_deck = await evaluate_readme(body.readme_text, domain=body.domain)
    return {"pitch_deck": pitch_deck}

@router.post("/seller/listings", response_model=ListingDetail)
async def create_listing(
    body: PublishListingRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from slugify import slugify
    import uuid
    title = body.pitch_deck.get("title", "Untitled")
    slug = slugify(f"{title} {str(uuid.uuid4())[:8]}")
    listing = Listing(
        seller_id=user.id,
        slug=slug,
        title=title,
        short_description=body.pitch_deck.get("short_description", ""),
        expert_analysis=body.pitch_deck.get("expert_analysis", ""),
        category="Software",
        tech_stack=body.pitch_deck.get("tech_stack", []),
        complexity="Intermediate",
        revenue_model="One-time",
        growth_potential_score=85,
        price_cents=body.price_cents,
        visibility=body.visibility,
        meta_title=title,
        meta_description=body.pitch_deck.get("short_description", ""),
        github_repo_url=body.github_repo_url,
        live_demo_url=body.live_demo_url,
        demo_video_url=body.demo_video_url,
        pitch_deck=body.pitch_deck
    )
    import sqlalchemy
    try:
        db.add(listing)
        await db.commit()
        await db.refresh(listing)
        return ListingDetail.model_validate(listing)
    except sqlalchemy.exc.IntegrityError:
        await db.rollback()
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Repository is already listed.")


class UpdateListingRequest(BaseModel):
    price_cents: int | None = None
    demo_video_url: str | None = None
    live_demo_url: str | None = None
    extra_description: str | None = None  # stored in pitch_deck

@router.patch("/seller/listings/{listing_id}", response_model=ListingDetail)
async def update_listing(
    listing_id: uuid.UUID,
    body: UpdateListingRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Listing).where(Listing.id == listing_id, Listing.seller_id == user.id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found or access denied")
    if body.price_cents is not None:
        listing.price_cents = body.price_cents
    if body.demo_video_url is not None:
        listing.demo_video_url = body.demo_video_url
    if body.live_demo_url is not None:
        listing.live_demo_url = body.live_demo_url
    if body.extra_description is not None:
        pd = dict(listing.pitch_deck or {})
        pd["extra_description"] = body.extra_description
        listing.pitch_deck = pd
    await db.commit()
    await db.refresh(listing)
    return ListingDetail.model_validate(listing)

@router.post("/transactions/{transaction_id}/deliver")
async def mark_delivered(
    transaction_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Transaction).join(Listing).where(Transaction.id == transaction_id, Listing.seller_id == user.id)
    )
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found or not authorized")
    
    transaction.escrow_status = "delivered"
    await db.commit()
    return {"ok": True}

@router.post("/transactions/{transaction_id}/confirm-receipt")
async def confirm_receipt(
    transaction_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == user.id)
    )
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction.escrow_status != "delivered":
        raise HTTPException(status_code=400, detail="Cannot confirm receipt before delivery")
        
    transaction.escrow_status = "released"
    await db.commit()
    return {"ok": True}

@router.get("/dashboard/sales", response_model=list[TransactionResponse])
async def get_sales(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    result = await db.execute(
        select(Transaction)
        .options(joinedload(Transaction.listing))
        .join(Listing)
        .where(Listing.seller_id == user.id)
        .order_by(Transaction.created_at.desc())
    )
    return result.scalars().all()

@router.get("/dashboard/listings", response_model=list[ListingDetail])
async def get_my_listings(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Listing)
        .where(Listing.seller_id == user.id)
        .order_by(Listing.created_at.desc())
    )
    return result.scalars().all()


class CreateBountyRequest(BaseModel):
    github_issue_url: str
    amount_cents: int

@router.post("/bounties")
async def create_bounty(body: CreateBountyRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.models.bounty import Bounty
    bounty = Bounty(
        funder_id=user.id,
        github_issue_url=body.github_issue_url,
        amount_cents=body.amount_cents,
        status="open"
    )
    db.add(bounty)
    await db.commit()
    return {"ok": True, "bounty_id": str(bounty.id)}

@router.get("/bounties")
async def list_bounties(db: AsyncSession = Depends(get_db)):
    from app.models.bounty import Bounty
    result = await db.execute(select(Bounty).order_by(Bounty.created_at.desc()))
    bounties = result.scalars().all()
    return [{
        "id": str(b.id),
        "funder_id": str(b.funder_id),
        "github_issue_url": b.github_issue_url,
        "amount_cents": b.amount_cents,
        "status": b.status
    } for b in bounties]

@router.post("/bounties/{bounty_id}/resolve")
async def resolve_bounty(bounty_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    from app.models.bounty import Bounty
    result = await db.execute(select(Bounty).where(Bounty.id == bounty_id))
    bounty = result.scalar_one_or_none()
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")
    bounty.status = "resolved"
    await db.commit()
    return {"ok": True}
@router.get("/dashboard/purchases")
async def get_purchases(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == user.id)
        .options(selectinload(Transaction.listing))
    )
    transactions = result.scalars().all()
    responses = []
    for t in transactions:
        resp = TransactionResponse.model_validate(t)
        if t.listing and t.escrow_status in ("delivered", "released"):
            resp.github_repo_url = t.listing.github_repo_url
        responses.append(resp)
    return responses
