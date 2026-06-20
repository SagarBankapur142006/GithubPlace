import requests
try:
    res = requests.post("http://localhost:8000/api/seller/evaluate", json={"readme_text": "test"})
    print("STATUS", res.status_code)
    print("BODY", res.text)
except Exception as e:
    print("ERROR", str(e))
