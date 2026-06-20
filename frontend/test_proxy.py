import requests
try:
    res = requests.get("http://localhost:3000/api/listings/stats", timeout=5)
    print("STATUS", res.status_code)
except Exception as e:
    print("ERROR", str(e))
