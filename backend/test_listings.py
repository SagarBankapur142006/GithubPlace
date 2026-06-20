import requests

payload = {
  "github_repo_url": "https://github.com/SagarBankapur142006/extension_for_saving",
  "pitch_deck": {
    "title": "Generated Pitch (Fallback)",
    "short_description": "AI Rate Limit Reached - Fallback Data",
    "problem": "Too many requests to Gemini API.",
    "solution": "This dummy data ensures the demo keeps running.",
    "target_audience": "Developers testing limits",
    "tech_stack": ["React", "FastAPI", "Fallback"],
    "suggested_price_cents": 19900,
    "expert_analysis": "This project looks solid, but AI evaluation was skipped due to rate limits."
  },
  "price_cents": 19900,
  "visibility": "public"
}

try:
    # We will get 401 because we are not authenticated.
    res = requests.post("http://localhost:8000/api/seller/listings", json=payload)
    print("STATUS", res.status_code)
    print("BODY", res.text)
except Exception as e:
    print("ERROR", str(e))
