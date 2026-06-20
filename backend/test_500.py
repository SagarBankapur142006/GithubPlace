from fastapi import APIRouter
from app.main import app

@app.get("/api/test-500")
async def test_500():
    raise Exception("Test 500 error")

import requests
try:
    res = requests.options("http://localhost:8000/api/test-500", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
    print("OPTIONS STATUS", res.status_code)
    print("OPTIONS HEADERS", res.headers)
    
    res = requests.get("http://localhost:8000/api/test-500", headers={"Origin": "http://localhost:3000"})
    print("GET STATUS", res.status_code)
    print("GET HEADERS", res.headers)
except Exception as e:
    print("ERROR", str(e))
