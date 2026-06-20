# Ideora — Autonomous GitHub Marketplace

Ideora autonomously scouts GitHub, classifies repositories with AI, prices them, and publishes SEO-optimized listings for buyers to search and purchase.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Next.js    │────▶│   FastAPI    │────▶│ PostgreSQL  │
│  Frontend   │     │   API        │     │             │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────▼───────┐
                    │ APScheduler  │
                    │ Scout Worker │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         GitHub API    OpenAI/Gemini   Stripe
```

### Scheduler choice: APScheduler vs Celery+Redis

| | APScheduler | Celery + Redis |
|---|---|---|
| **Infra** | Single Python process | Requires Redis broker |
| **Best for** | Local dev, solo deploy (Railway/Render) | High-volume distributed workers |
| **Retries** | Manual | Built-in |
| **Our choice** | ✅ Implemented | Documented swap path |

To migrate to Celery: move `run_scout_cycle` into a `@celery.task` and run `celery -A worker.celery_app worker -B`.

## Quick Start

### 1. Database

**Option A — Docker Postgres (production-like):**
```bash
docker compose up postgres -d
```

**Option B — SQLite (local dev, no Docker):**
```bash
# backend/.env
USE_SQLITE=true
```

Then bootstrap:
```bash
cd backend
pip install -r requirements.txt
python scripts/bootstrap.py
```

Or on Windows: `.\scripts\dev.ps1`
### 2. Backend API

```bash
cd backend
cp .env.example .env
# Edit .env: add GITHUB_TOKEN, OPENAI_API_KEY (or GEMINI), optional STRIPE keys

python -m uvicorn app.main:app --reload --port 8000
```

### 3. Run scout pipeline (manual)

```bash
cd backend
python -m scout.run_once
```

Or trigger via API:

```bash
curl -X POST http://localhost:8000/api/internal/trigger-scout
```

### 4. Start scheduler worker

```bash
cd backend
python -m worker.scheduler
```

### 5. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

## Environment Variables

See `backend/.env.example` and `frontend/.env.local.example`.

**Required for scout pipeline:**
- `GITHUB_TOKEN` — GitHub personal access token (raises rate limits)
- `OPENAI_API_KEY` or `GEMINI_API_KEY` — AI classification (fallback heuristic used if missing)

**Required for payments:**
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/signup` | Create buyer account |
| POST | `/api/auth/signin` | Sign in (httpOnly cookie) |
| POST | `/api/auth/signout` | Clear session |
| GET | `/api/auth/me` | Current user |
| GET | `/api/listings` | Search listings (`q`, `category`, filters) |
| GET | `/api/listings/:slug` | Listing detail |
| GET | `/api/listings/autocomplete` | Autocomplete suggestions |
| POST | `/api/checkout/create-session` | Stripe Checkout Session |
| POST | `/api/checkout/webhook` | Stripe webhook |
| GET | `/api/transactions/:id` | Transaction status |
| GET | `/api/transactions/:id/download` | Download fulfillment zip |
| POST | `/api/internal/trigger-scout` | Manual scout trigger |

## Search Logic

Synonym mapping and typo correction live in **both** layers:
- **Server** (`backend/app/search.py`) — authoritative filtering on `GET /api/listings`
- **Client** (`frontend/lib/search.ts`) — instant spellcheck UX before API call

## Scout Pipeline

```
discover_candidates() → fetch_repo_metadata() → classify_with_ai()
    → compute_price() → generate_seo_fields() → upsert_listing()
```

**Price heuristic** (`scout/pricing.py`): `growth_score × $80 × star_factor × contributor_factor × recency × complexity`. Marked with `SWAP POINT` comment for ML regression replacement.

**Fulfillment**: Zip package of GitHub archive + `IDEORA_OWNERSHIP_NOTICE.txt` with explicit non-IP-transfer disclaimer.

## Deployment

- **Frontend**: Vercel (`frontend/`)
- **API + Worker + Postgres**: Railway or Render via `docker-compose.yml`

Set `FRONTEND_URL`, `BACKEND_URL`, `COOKIE_SECURE=true` in production.

## Legal Copy

All UI surfaces state that acquisitions convey packaged codebase + usage rights per open-source license — **not** verified legal IP transfer from original authors.
