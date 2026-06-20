import requests
try:
    res = requests.options("http://localhost:8000/api/seller/evaluate", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"})
    print("STATUS", res.status_code)
    print("HEADERS", res.headers)
except Exception as e:
    print("ERROR", str(e))
