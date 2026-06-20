"""Pydantic schemas for API request/response."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str | None = None


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ListingSummary(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    short_description: str
    category: str
    tech_stack: list[str]
    complexity: str
    revenue_model: str
    growth_potential_score: int
    price_cents: int
    currency: str
    status: str
    visibility: str
    github_stars: int

    model_config = {"from_attributes": True}


class ListingDetail(ListingSummary):
    expert_analysis: str
    meta_title: str
    meta_description: str
    json_ld: dict
    github_repo_url: str | None
    live_demo_url: str | None
    demo_video_url: str | None
    pitch_deck: dict
    github_forks: int
    license: str | None
    last_commit_at: datetime | None
    created_at: datetime


class ListingsResponse(BaseModel):
    items: list[ListingSummary]
    total: int
    query: str | None = None
    suggested_query: str | None = None


class CheckoutSessionRequest(BaseModel):
    listing_id: uuid.UUID


class RazorpayOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    transaction_id: uuid.UUID


class RazorpayVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class TransactionResponse(BaseModel):
    id: uuid.UUID
    status: str
    fulfillment_status: str
    escrow_status: str
    amount_cents: int
    listing: ListingSummary | None = None
    fulfillment_assets: list[dict] = []
    github_repo_url: str | None = None

    model_config = {"from_attributes": True}


class ScoutTriggerResponse(BaseModel):
    stats: dict[str, int]


class EvaluateRequest(BaseModel):
    readme_text: str


class ExtensionEvaluateRequest(BaseModel):
    readme_text: str
    domain: str = "general"


class PublishListingRequest(BaseModel):
    github_repo_url: str | None = None
    live_demo_url: str | None = None
    demo_video_url: str | None = None
    pitch_deck: dict
    price_cents: int
    visibility: str = "private"
