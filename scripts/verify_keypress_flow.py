import urllib.request
import urllib.parse
import json
import time

SERVER_URL = "http://localhost:8000/api/keypress"

def test_keypress(key):
    data = json.dumps({"key": key}).encode("utf-8")
    req = urllib.request.Request(SERVER_URL, data=data, headers={"Content-Type": "application/json"}, method="POST")
    start = time.time()
    try:
        response = urllib.request.urlopen(req)
        status = response.getcode()
        body = response.read().decode("utf-8")
    except Exception as e:
        status = 500
        body = str(e)
    elapsed = (time.time() - start) * 1000
    
    print(f"Key: {key:<10} | Status: {status} | Time: {elapsed:.2f}ms")
    assert status == 200, f"Expected HTTP 200, got {status}"
    assert elapsed < 50, f"Keypress took too long: {elapsed:.2f}ms (must be <50ms)"

def run_tests():
    keys = ["Lit_H", "Lit_e", "Lit_l", "Lit_l", "Lit_o", "Backspace"]
    for k in keys:
        test_keypress(k)
    print("All keypress tests passed!")

if __name__ == "__main__":
    run_tests()
