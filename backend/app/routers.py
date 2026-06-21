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
    GithubAuthRequest,
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


@router.post("/auth/github", response_model=UserResponse)
async def github_auth(body: GithubAuthRequest, response: Response, db: AsyncSession = Depends(get_db)):
    import httpx
    import logging
    logger = logging.getLogger("ideora.auth.github")

    settings = get_settings()

    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(
            status_code=500,
            detail="GitHub OAuth is not configured on the server."
        )

    access_token = None
    github_id = None
    github_username = None
    full_name = None
    email = None

    # 1. Exchange authorization code for access token
    try:
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": settings.github_client_id,
                    "client_secret": settings.github_client_secret,
                    "code": body.code,
                    "redirect_uri": body.redirect_uri
                },
                timeout=15.0
            )
            logger.info(f"GitHub token exchange status: {token_resp.status_code}")
            token_data = token_resp.json()
            logger.info(f"GitHub token response keys: {list(token_data.keys())}")

            access_token = token_data.get("access_token")
            if not access_token:
                error_desc = token_data.get("error_description") or token_data.get("error", "Invalid or expired authorization code")
                raise HTTPException(status_code=400, detail=f"GitHub OAuth error: {error_desc}")

            # 2. Fetch User Profile
            profile_resp = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28"
                },
                timeout=10.0
            )
            if profile_resp.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to fetch user profile from GitHub")

            profile = profile_resp.json()
            github_id = str(profile.get("id"))
            github_username = profile.get("login")
            full_name = profile.get("name") or github_username
            email = profile.get("email")

            # 3. Retrieve Email if private
            if not email:
                emails_resp = await client.get(
                    "https://api.github.com/user/emails",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Accept": "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28"
                    },
                    timeout=10.0
                )
                if emails_resp.status_code == 200:
                    email_list = emails_resp.json()
                    # First try primary+verified
                    for e in email_list:
                        if e.get("primary") and e.get("verified"):
                            email = e.get("email")
                            break
                    # Fallback to any email
                    if not email and email_list:
                        email = email_list[0].get("email")

            if not email:
                email = f"{github_username.lower()}@users.noreply.github.com"

    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except httpx.RequestError as exc:
        logger.error(f"GitHub API request failed: {exc}")
        raise HTTPException(status_code=503, detail=f"GitHub is temporarily unreachable: {exc}")
    except Exception as exc:
        logger.error(f"Unexpected error in GitHub OAuth token exchange: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"OAuth exchange failed: {str(exc)}")

    # 4. Find or create user in DB
    try:
        result = await db.execute(select(User).where(User.github_id == github_id))
        user = result.scalar_one_or_none()

        if not user:
            result = await db.execute(select(User).where(User.email == email.lower()))
            user = result.scalar_one_or_none()

        if user:
            user.github_id = github_id
            user.github_username = github_username
            user.github_token = access_token
            if not user.full_name:
                user.full_name = full_name
        else:
            user = User(
                email=email.lower(),
                password_hash=None,
                full_name=full_name,
                github_id=github_id,
                github_username=github_username,
                github_token=access_token
            )
            db.add(user)

        await db.flush()
        token = create_access_token(user.id)
        set_auth_cookie(response, token)
        await db.commit()
        logger.info(f"GitHub OAuth login success for user: {github_username}")
        return user

    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        logger.error(f"Database error during GitHub OAuth login: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create user session: {str(exc)}")


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

    return TransactionResponse(
        id=transaction.id,
        status=transaction.status,
        fulfillment_status=transaction.fulfillment_status,
        amount_cents=transaction.amount_cents,
        listing=ListingSummary.model_validate(listing) if listing else None,
        fulfillment_assets=[],
    )


@router.get("/transactions/{transaction_id}/download")
async def download_fulfillment(
    transaction_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Direct package downloads are disabled. Access your codebase via the seller repository link in your dashboard."
    )


@router.post("/checkout/dev-confirm/{transaction_id}")
async def dev_confirm_checkout(
    transaction_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dev-only: simulate successful payment when Razorpay is not configured."""
    from app.config import get_settings

    settings = get_settings()
    if settings.razorpay_key_id and settings.razorpay_key_secret:
        raise HTTPException(status_code=404, detail="Not available when Razorpay is active")

    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == user.id)
    )
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if transaction.status != "succeeded":
        transaction.status = "succeeded"
        transaction.fulfillment_status = "delivered"
        transaction.escrow_status = "held"
        listing_result = await db.execute(select(Listing).where(Listing.id == transaction.listing_id))
        listing = listing_result.scalar_one_or_none()
        if listing:
            listing.status = "sold"
        await db.flush()

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


async def fetch_github_api(url: str, settings) -> dict | None:
    import httpx
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, headers=headers, timeout=10.0)
            if resp.status_code == 200:
                return resp.json()
        except Exception:
            pass
    return None


class CreateBountyRequest(BaseModel):
    github_issue_url: str
    amount_cents: int
    custom_instructions: str | None = None


class ResolveBountyPRRequest(BaseModel):
    pr_url: str


class CreateDeploymentRequest(BaseModel):
    repo_url: str
    subdomain: str
    pricing_tier: str
    app_name: str


@router.post("/bounties")
async def create_bounty(body: CreateBountyRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.models.bounty import Bounty
    from app.config import get_settings
    import re
    
    settings = get_settings()
    
    # Fetch issue details for cache
    title = None
    repo_name = None
    avatar_url = None
    description = None
    comments_count = 0
    
    issue_match = re.match(r"https://github\.com/([^/]+)/([^/]+)/issues/(\d+)", body.github_issue_url)
    num = ""
    if issue_match:
        owner, repo, num = issue_match.groups()
        repo_name = f"{owner}/{repo}"
        issue_data = await fetch_github_api(f"https://api.github.com/repos/{owner}/{repo}/issues/{num}", settings)
        if issue_data:
            title = issue_data.get("title")
            description = issue_data.get("body")
            comments_count = issue_data.get("comments", 0)
            avatar_url = issue_data.get("user", {}).get("avatar_url")
            
    bounty = Bounty(
        funder_id=user.id,
        github_issue_url=body.github_issue_url,
        amount_cents=body.amount_cents,
        status="open",
        title=title or f"Issue #{num if issue_match else ''}",
        repo_name=repo_name or "Unknown Repo",
        avatar_url=avatar_url,
        description=description,
        comments_count=comments_count,
        custom_instructions=body.custom_instructions
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
        "status": b.status,
        "title": b.title,
        "repo_name": b.repo_name,
        "avatar_url": b.avatar_url,
        "description": b.description,
        "comments_count": b.comments_count,
        "custom_instructions": b.custom_instructions
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


@router.post("/bounties/{bounty_id}/resolve-pr")
async def resolve_bounty_pr(
    bounty_id: uuid.UUID,
    body: ResolveBountyPRRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.models.bounty import Bounty
    from app.config import get_settings
    import re
    
    result = await db.execute(select(Bounty).where(Bounty.id == bounty_id))
    bounty = result.scalar_one_or_none()
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")
        
    if bounty.status == "resolved":
        return {"ok": True, "contributor": "already_resolved"}
        
    # Parse PR
    pr_match = re.match(r"https://github\.com/([^/]+)/([^/]+)/pull/(\d+)", body.pr_url)
    if not pr_match:
        raise HTTPException(status_code=400, detail="Invalid GitHub Pull Request URL")
        
    owner, repo, pr_num = pr_match.groups()
    settings = get_settings()
    
    pr_data = await fetch_github_api(f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_num}", settings)
    if not pr_data:
        raise HTTPException(status_code=400, detail="Could not retrieve Pull Request details from GitHub API")
        
    # Check if PR is merged
    if not pr_data.get("merged", False):
        raise HTTPException(status_code=400, detail="Pull Request has not been merged yet")
        
    contributor = pr_data.get("user", {}).get("login", "Contributor")
    
    bounty.status = "resolved"
    await db.commit()
    return {"ok": True, "contributor": contributor}


@router.get("/github/detect-framework")
async def detect_framework(url: str, user: User = Depends(get_current_user)):
    from app.config import get_settings
    import re
    settings = get_settings()
    
    repo_match = re.match(r"https://github\.com/([^/]+)/([^/]+)", url)
    if not repo_match:
        raise HTTPException(status_code=400, detail="Invalid GitHub Repository URL")
        
    owner, repo = repo_match.groups()
    if repo.endswith(".git"):
        repo = repo[:-4]
        
    # Get contents of root directory
    contents = await fetch_github_api(f"https://api.github.com/repos/{owner}/{repo}/contents", settings)
    if not contents or not isinstance(contents, list):
        return {"framework": "Generic Service"}
        
    filenames = {c.get("name") for c in contents if c.get("name")}
    
    if "next.config.js" in filenames or "next.config.mjs" in filenames:
        return {"framework": "Next.js/React"}
    elif "package.json" in filenames:
        return {"framework": "NodeJS/Express"}
    elif "manage.py" in filenames or "requirements.txt" in filenames or "pyproject.toml" in filenames:
        return {"framework": "Python/FastAPI/Django"}
    elif "index.html" in filenames:
        return {"framework": "Static HTML/JS"}
    return {"framework": "Generic Service"}


@router.post("/deployments")
async def create_deployment(
    body: CreateDeploymentRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.models.deployment import Deployment
    from app.config import get_settings
    from app.services.ai_evaluator import generate_saasify_preview
    import re
    
    # Check subdomain availability
    sub_check = await db.execute(select(Deployment).where(Deployment.subdomain == body.subdomain))
    if sub_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Subdomain is already in use")
        
    # Fetch README.md contents for AI evaluator
    settings = get_settings()
    repo_match = re.match(r"https://github\.com/([^/]+)/([^/]+)", body.repo_url)
    readme_text = "No readme provided."
    if repo_match:
        owner, repo = repo_match.groups()
        if repo.endswith(".git"):
            repo = repo[:-4]
        readme_data = await fetch_github_api(f"https://api.github.com/repos/{owner}/{repo}/readme", settings)
        if readme_data and readme_data.get("download_url"):
            import httpx
            async with httpx.AsyncClient() as client:
                try:
                    resp = await client.get(readme_data.get("download_url"), timeout=5.0)
                    if resp.status_code == 200:
                        readme_text = resp.text
                except Exception:
                    pass
                    
    # Generate live preview layout using AI
    preview_schema = await generate_saasify_preview(readme_text, body.app_name)
    
    deployment = Deployment(
        user_id=user.id,
        repo_url=body.repo_url,
        subdomain=body.subdomain,
        pricing_tier=body.pricing_tier,
        preview_schema=preview_schema
    )
    
    db.add(deployment)
    await db.commit()
    await db.refresh(deployment)
    return {
        "id": str(deployment.id),
        "subdomain": deployment.subdomain,
        "repo_url": deployment.repo_url,
        "pricing_tier": deployment.pricing_tier,
        "live_url": f"https://{deployment.subdomain}.ideora.app",
        "created_at": deployment.created_at.isoformat()
    }


@router.get("/deployments")
async def list_deployments(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.models.deployment import Deployment
    result = await db.execute(select(Deployment).where(Deployment.user_id == user.id).order_by(Deployment.created_at.desc()))
    deployments = result.scalars().all()
    return [{
        "id": str(d.id),
        "subdomain": d.subdomain,
        "repo_url": d.repo_url,
        "pricing_tier": d.pricing_tier,
        "live_url": f"https://{d.subdomain}.ideora.app",
        "created_at": d.created_at.isoformat()
    } for d in deployments]


@router.get("/deployments/{deployment_id}")
async def get_deployment(
    deployment_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.models.deployment import Deployment
    result = await db.execute(select(Deployment).where(Deployment.id == deployment_id, Deployment.user_id == user.id))
    deployment = result.scalar_one_or_none()
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return {
        "id": str(deployment.id),
        "subdomain": deployment.subdomain,
        "repo_url": deployment.repo_url,
        "pricing_tier": deployment.pricing_tier,
        "preview_schema": deployment.preview_schema,
        "live_url": f"https://{deployment.subdomain}.ideora.app",
        "created_at": deployment.created_at.isoformat()
    }
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


@router.get("/github/repos")
async def get_github_repos(username: str | None = None, user: User = Depends(get_current_user)):
    from app.config import get_settings
    import httpx
    settings = get_settings()
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    
    # Use user's personal GitHub OAuth token if available, otherwise fallback to server global token
    token = user.github_token or settings.github_token
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    async with httpx.AsyncClient() as client:
        try:
            if username:
                url = f"https://api.github.com/users/{username}/repos?type=public&sort=updated"
            elif user.github_token:
                # Fetch repositories of the currently authenticated user
                url = "https://api.github.com/user/repos?type=public&sort=updated"
            elif user.github_username:
                url = f"https://api.github.com/users/{user.github_username}/repos?type=public&sort=updated"
            else:
                raise HTTPException(
                    status_code=400,
                    detail="GitHub account not linked. Please provide a username."
                )

            resp = await client.get(url, headers=headers, timeout=10.0)
            if resp.status_code != 200:
                detail = "Failed to fetch repos from GitHub"
                try:
                    detail = resp.json().get("message", detail)
                except Exception:
                    pass
                raise HTTPException(status_code=resp.status_code, detail=detail)
            return resp.json()
        except httpx.RequestError as exc:
            raise HTTPException(status_code=503, detail=f"GitHub API is unreachable: {exc}")
