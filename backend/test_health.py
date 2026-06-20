import requests
try:
    res = requests.get("http://localhost:8000/api/listings/stats", timeout=3)
    print("STATUS:", res.status_code)
except Exception as e:
    print("ERROR:", e)
