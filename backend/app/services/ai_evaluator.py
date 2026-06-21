import json
import logging
import openai
import google.generativeai as genai
from app.config import get_settings

logger = logging.getLogger(__name__)


def build_prompt(readme_text: str, domain: str = "general") -> str:
    domain_context = {
        "data_analytics": """
  You specialize in evaluating DATA ANALYTICS, BUSINESS INTELLIGENCE, and DATA ENGINEERING platforms.
  Apply extra scrutiny to:
  - ETL pipeline architecture and data ingestion capabilities
  - Dashboard and visualization quality (charts, real-time updates, drill-downs)
  - Support for major data warehouses (BigQuery, Snowflake, Redshift, Databricks)
  - API integrations with business tools (Salesforce, HubSpot, Stripe, QuickBooks)
  - Data governance, lineage tracking, and audit trails
  - Query performance optimization and caching strategies
  - Export formats (CSV, Excel, PDF reports, API endpoints)
  - Role-based access control for enterprise data security
  - Pricing benchmark: Looker was acquired for $2.6B, Tableau for $15.7B, Metabase OSS valued ~$200M
  - Score data completeness, freshness indicators, and anomaly detection features highly
""",
        "saas": """
  You specialize in evaluating B2B SaaS products and subscription software platforms.
  Apply extra scrutiny to:
  - Multi-tenancy architecture and tenant isolation
  - Subscription billing integration (Stripe, Paddle, Chargebee)
  - Onboarding flow and time-to-value for new customers
  - Feature gating and plan management capabilities
  - Customer success tooling (in-app messaging, NPS, health scores)
  - SLA monitoring, uptime guarantees, and status pages
  - API-first design with webhooks and developer documentation
  - GDPR, SOC2, and compliance readiness
  - Pricing benchmark: typical SaaS template sells for $500–$8,000 depending on vertical
  - Score churn reduction features and expansion revenue mechanics highly
""",
        "fintech": """
  You specialize in evaluating FINTECH, payments, and financial infrastructure platforms.
  Apply extra scrutiny to:
  - Payment gateway integrations (Stripe, Razorpay, Braintree, Plaid)
  - KYC/AML compliance modules and identity verification
  - Double-entry bookkeeping and financial audit trails
  - PCI-DSS compliance indicators
  - Fraud detection and risk scoring systems
  - Multi-currency and international payment support
  - Open banking API integrations
  - Regulatory reporting capabilities (GAAP, IFRS)
  - Pricing benchmark: fintech codebases command 2-4x premium over generic SaaS
  - Score security architecture and encryption standards very highly
""",
        "general": """
  You specialize in evaluating general software products across all technology verticals.
  Consider the full spectrum: developer tools, consumer apps, enterprise software, APIs, and frameworks.
"""
    }.get(domain, "")

    return f"""
=============================================================================
IDEORA M&A INTELLIGENCE ENGINE — SENIOR ACQUISITION ANALYST SYSTEM PROMPT
Version 3.1 | Specialized Domain: {domain.upper().replace("_", " ")}
=============================================================================

You are a world-class mergers & acquisitions analyst with 15 years of experience
evaluating software companies for acquisition. You have advised on deals including
GitHub ($7.5B), Figma ($20B attempted), Qualtrics ($8B), and hundreds of Series A-C
software acquisitions. You combine deep technical due diligence with commercial acumen.

Your role on the Ideora Marketplace is to evaluate source code repositories and
generate authoritative, investor-grade pitch decks that help buyers make confident
acquisition decisions. Every evaluation you produce must be thorough, specific,
commercially grounded, and immediately actionable.

---
DOMAIN SPECIALIZATION
---
{domain_context}

---
EVALUATION FRAMEWORK — SCORE EACH DIMENSION (0–100)
---

DIMENSION 1 — TECHNICAL ARCHITECTURE (weight: 20%)
  Evaluate: separation of concerns, modularity, test coverage, CI/CD pipeline presence,
  containerization (Docker/K8s), horizontal scalability potential, database schema design,
  API design quality (REST/GraphQL/gRPC), caching strategy, logging and observability.
  Red flags: monolithic God classes, hardcoded credentials, no error handling, SQLite in prod.
  Green flags: microservices or clean monolith, 12-factor app principles, async architecture.

DIMENSION 2 — MARKET OPPORTUNITY (weight: 20%)
  Evaluate: TAM/SAM for the target vertical, competitive landscape density, timing (is the
  market nascent, growing, or saturated?), pricing power, customer willingness to pay,
  and whether the codebase has defensible moats (network effects, data flywheel, switching costs).
  Reference: Gartner, Forrester, CB Insights market sizing where applicable.

DIMENSION 3 — REVENUE POTENTIAL (weight: 20%)
  Evaluate: monetization model (SaaS subscription, usage-based, marketplace, one-time license),
  expansion revenue mechanics (seats, usage, add-ons), payment infrastructure readiness,
  average contract value potential, and go-to-market speed (days to first dollar).
  Consider: Can a non-technical buyer operate this? What is the payback period?

DIMENSION 4 — CODE QUALITY & MAINTAINABILITY (weight: 15%)
  Evaluate: documentation quality, README completeness, inline comments, dependency hygiene
  (outdated packages, known CVEs), framework choices (mainstream vs obscure), TypeScript usage,
  linting configuration, code formatting standards, and estimated technical debt.
  Tool signals: presence of .eslintrc, .prettierrc, pyproject.toml, jest.config, Dockerfile.

DIMENSION 5 — INTEGRATION ECOSYSTEM (weight: 10%)
  Evaluate: third-party integrations already built (auth, payments, email, analytics, CRM),
  webhook support, API authentication (OAuth2, API keys, JWT), SDK availability, and
  how easily the codebase can plug into a buyer's existing technology stack.

DIMENSION 6 — SECURITY POSTURE (weight: 10%)
  Evaluate: authentication mechanism strength, authorization model (RBAC, ABAC), data encryption
  (at rest and in transit), secrets management, input validation, SQL injection prevention,
  XSS protection, rate limiting, and CORS configuration.
  Red flags: passwords in plaintext, no HTTPS enforcement, missing auth middleware.

DIMENSION 7 — SCALABILITY & DEVOPS READINESS (weight: 5%)
  Evaluate: infrastructure-as-code (Terraform, Pulumi), deployment automation, environment
  configuration management, database migration tooling, load testing evidence, CDN usage,
  and cloud provider agnosticism vs lock-in.

---
ACQUISITION PRICING METHODOLOGY
---
Use the following comparable transaction data to anchor your price recommendation:

  DEVELOPER TOOLS:
    - Simple CLI tool or library: $500 – $3,000
    - Mid-complexity dev tool with users: $3,000 – $15,000
    - Production-ready SaaS boilerplate: $5,000 – $25,000

  BUSINESS / ANALYTICS SOFTWARE:
    - Basic dashboard template: $1,500 – $8,000
    - Full analytics platform with integrations: $8,000 – $50,000
    - Enterprise BI tool with data pipeline: $20,000 – $150,000+

  FINTECH / PAYMENTS:
    - Payment integration boilerplate: $2,000 – $10,000
    - Full lending or trading platform: $15,000 – $100,000+

  MARKETPLACE / PLATFORM:
    - Two-sided marketplace MVP: $5,000 – $30,000
    - Full marketplace with escrow + AI: $15,000 – $75,000

  CONSUMER APPS:
    - Mobile app with basic features: $1,000 – $8,000
    - App with strong design + backend: $5,000 – $20,000

Apply a MULTIPLIER based on quality score:
  Score 90–100: 1.5x base price (premium asset)
  Score 70–89:  1.0x base price (market rate)
  Score 50–69:  0.7x base price (discount asset)
  Score below 50: 0.4x base price (fixer-upper)

---
EXPERT ANALYSIS REQUIREMENTS
---
Your "expert_analysis" field must be a MINIMUM of 4 paragraphs covering:

  PARAGRAPH 1 — TECHNICAL VERDICT:
    Specific praise or critique of the architecture. Name actual technologies observed.
    What would a CTO care about? What impresses or concerns you?

  PARAGRAPH 2 — COMMERCIAL OPPORTUNITY:
    Who is the ideal acquirer? (a bootstrapped founder? a VC-backed startup? a corporate?)
    What vertical does this fit best? What is the 12-month revenue potential?

  PARAGRAPH 3 — RISK FACTORS:
    What are the top 3 risks for a buyer? Technical debt? Market competition?
    Dependency on a deprecated technology? Single-point-of-failure architecture?

  PARAGRAPH 4 — ACQUISITION RECOMMENDATION:
    Should the buyer acquire, pass, or negotiate? What due diligence should they do?
    What is the 30-60-90 day plan post-acquisition to unlock value?

---
OUTPUT FORMAT
---
Respond with ONLY a raw JSON object. No markdown. No explanation. No code fences.
Use exactly these keys:

{{
  "title": "Product name (max 6 words, professional and market-ready)",
  "short_description": "One compelling sentence a VP of Product would use in a board deck",
  "problem": "The specific market pain point this codebase addresses (2-3 sentences)",
  "solution": "How this codebase solves the problem with specific technical callouts (2-3 sentences)",
  "target_audience": "Primary buyer persona with industry, role, and company stage",
  "tech_stack": ["list", "of", "actual", "technologies", "detected"],
  "suggested_price_cents": 150000,
  "growth_potential_score": 78,
  "category": "One of: Analytics, SaaS, Fintech, DevTool, Marketplace, AI/ML, Healthcare, EdTech, Other",
  "complexity": "One of: Low, Medium, High, Enterprise",
  "revenue_model": "One of: Subscription, Usage-Based, Marketplace, One-Time License, Open Core",
  "expert_analysis": "Four detailed paragraphs as described above. Minimum 300 words total."
}}

---
README TO EVALUATE
---
{readme_text[:6000]}

=============================================================================
END OF SYSTEM PROMPT — BEGIN EVALUATION
=============================================================================
"""


async def evaluate_readme(readme_text: str, domain: str = "general") -> dict:
    settings = get_settings()
    prompt = build_prompt(readme_text, domain)

    if settings.ai_provider == "gemini" and settings.gemini_api_key:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(settings.gemini_model)
        try:
            try:
                response = await model.generate_content_async(prompt)
                text = response.text
            except AttributeError:
                response = model.generate_content(prompt)
                text = response.text
            return _parse_json(text)
        except Exception as e:
            logger.error("Gemini API failed (possibly rate limit): %s", e)
            return _fallback_data()

    elif settings.openai_api_key:
        try:
            client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
            response = await client.chat.completions.create(
                model=settings.openai_model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            text = response.choices[0].message.content
            return _parse_json(text)
        except Exception as e:
            logger.error("OpenAI API failed: %s", e)
            return _fallback_data()
    else:
        logger.warning("No AI keys configured, returning dummy data.")
        return _fallback_data()


def _fallback_data() -> dict:
    return {
        "title": "Generated Pitch (Fallback)",
        "short_description": "AI evaluation skipped — rate limit or no API key configured.",
        "problem": "Too many requests to the AI provider.",
        "solution": "This fallback data ensures the platform stays functional during API downtime.",
        "target_audience": "Developers and founders evaluating acquisition targets",
        "tech_stack": ["React", "FastAPI", "Python"],
        "suggested_price_cents": 19900,
        "growth_potential_score": 65,
        "category": "DevTool",
        "complexity": "Medium",
        "revenue_model": "One-Time License",
        "expert_analysis": (
            "This project was evaluated using fallback data because the AI provider returned "
            "a rate-limit error. The architecture appears functional based on the repository "
            "structure, but a full AI analysis could not be completed at this time.\n\n"
            "We recommend re-submitting this listing once the Gemini API quota resets "
            "(typically within 60 seconds on the free tier). The platform will automatically "
            "regenerate a full expert analysis on the next successful API call.\n\n"
            "From a commercial standpoint, the listing has been preserved with a placeholder "
            "valuation. The seller should consider editing the listing manually to add a "
            "demo video and extra description in the meantime.\n\n"
            "Acquisition recommendation: Pending full AI review. Do not make a purchase "
            "decision based on this fallback data alone."
        )
    }


def _parse_json(text: str) -> dict:
    try:
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return json.loads(text.strip())
    except Exception as exc:
        logger.error("Failed to parse AI JSON: %s\nText: %s", exc, text)
        return {}


async def generate_saasify_preview(readme_text: str, app_name: str) -> dict:
    settings = get_settings()
    prompt = f"""
You are a senior frontend UI/UX designer. Your task is to generate a custom UI layout specification (JSON format) to build a mock "Live Preview Dashboard" for a SaaS application named "{app_name}".
This dashboard should represent what the app would look like if it were deployed.

Use the README text below to understand the application's core functionality, features, target users, and key data indicators:
---
{readme_text[:4000]}
---

Produce a JSON object containing the layout configuration for this dashboard.
Use exactly this JSON format (do not add any extra fields, respond with only the JSON):
{{
  "dashboard_title": "e.g., Auth0 - Identity Management Console",
  "navigation_links": ["e.g., Users", "e.g., Applications", "e.g., Connections", "e.g., Settings"],
  "stats": [
    {{ "label": "Active Users", "value": "12,480", "change": "+12.3% this week" }},
    {{ "label": "API Requests", "value": "1.2M", "change": "99.9% uptime" }}
  ],
  "charts": [
    {{ "title": "Monthly Growth", "type": "bar", "labels": ["Jan", "Feb", "Mar", "Apr"], "data": [30, 45, 60, 85] }}
  ],
  "recent_activity": [
    {{ "timestamp": "2 mins ago", "description": "New tenant registered: Acme Corp" }},
    {{ "timestamp": "15 mins ago", "description": "SSL Certificate renewed automatically" }}
  ],
  "interactive_demo_widget": {{
    "title": "Try out the live API",
    "inputs": [
      {{ "label": "API Key", "placeholder": "Enter key...", "type": "text" }},
      {{ "label": "Payload", "placeholder": "{{\\"user\\": \\"test\\"}}", "type": "textarea" }}
    ],
    "button_text": "Send Request",
    "simulated_output_format": "JSON",
    "simulated_success_output": "{{\\"status\\": \\"success\\", \\"data\\": {{\\"id\\": 123, \\"processed\\": true}}}}"
  }}
}}

Respond with ONLY the raw JSON object. No markdown. No explanation.
"""

    if settings.ai_provider == "gemini" and settings.gemini_api_key:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(settings.gemini_model)
        try:
            try:
                response = await model.generate_content_async(prompt)
                text = response.text
            except AttributeError:
                response = model.generate_content(prompt)
                text = response.text
            return _parse_json(text)
        except Exception as e:
            logger.error("Gemini SaaSify preview generation failed: %s", e)
            return _fallback_saasify_data(app_name)
    elif settings.openai_api_key:
        try:
            client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
            response = await client.chat.completions.create(
                model=settings.openai_model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            text = response.choices[0].message.content
            return _parse_json(text)
        except Exception as e:
            logger.error("OpenAI SaaSify preview generation failed: %s", e)
            return _fallback_saasify_data(app_name)
    else:
        return _fallback_saasify_data(app_name)


def _fallback_saasify_data(app_name: str) -> dict:
    return {
        "dashboard_title": f"{app_name} Dashboard",
        "navigation_links": ["Overview", "Deployments", "Logs", "Settings"],
        "stats": [
            { "label": "Requests (24h)", "value": "4,180", "change": "+5.2%" },
            { "label": "Average Latency", "value": "120ms", "change": "Uptime 100%" }
        ],
        "charts": [
            { "title": "API Traffic", "type": "line", "labels": ["Mon", "Tue", "Wed", "Thu", "Fri"], "data": [400, 520, 390, 610, 800] }
        ],
        "recent_activity": [
            { "timestamp": "Just now", "description": "SaaS application successfully deployed" },
            { "timestamp": "5 mins ago", "description": "Database connection verified" }
        ],
        "interactive_demo_widget": {
            "title": "Interactive API Console",
            "inputs": [
                { "label": "API Key", "placeholder": "ideora_live_key_...", "type": "text" },
                { "label": "Endpoint", "placeholder": "/api/v1/hello", "type": "text" }
            ],
            "button_text": "Test Endpoint",
            "simulated_output_format": "JSON",
            "simulated_success_output": '{"ok": true, "message": "Welcome to your SaaSify deployed API!"}'
        }
    }
