import urllib.request
import json
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
import sys
import os
from pathlib import Path

os.environ['no_proxy'] = '127.0.0.1,localhost'

PORT = 8013
BASE_URL = f"http://127.0.0.1:{PORT}"
ROOT_DIR = Path(__file__).resolve().parent.parent

class CustomHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

def start_server():
    os.chdir(str(ROOT_DIR))
    server = HTTPServer(("127.0.0.1", PORT), CustomHandler)
    server.serve_forever()

def run_audit():
    print("=== Runtime Site Verification Engine ===")
    
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    time.sleep(1)

    passed = 0
    failed = 0

    def check(name, condition, details=""):
        nonlocal passed, failed
        if condition:
            print(f"✅ [PASS] {name}")
            passed += 1
        else:
            print(f"❌ [FAIL] {name} - {details}")
            failed += 1

    try:
        with urllib.request.urlopen(f"{BASE_URL}/index.html") as response:
            check("index.html returns HTTP 200", response.status == 200)
    except Exception as e:
        check("index.html returns HTTP 200", False, str(e))

    payloads = [
        "clover_api/analytics/advanced_payload.json",
        "clover_api/analytics/category_payload.json",
        "clover_api/analytics/dashboard_payload.json"
    ]
    for p in payloads:
        try:
            with urllib.request.urlopen(f"{BASE_URL}/{p}") as response:
                check(f"{p} returns HTTP 200", response.status == 200)
                try:
                    data = json.loads(response.read().decode('utf-8'))
                    check(f"{p} is well-formed JSON", True)
                except Exception as e:
                    check(f"{p} is well-formed JSON", False, "Invalid JSON format")
        except Exception as e:
            check(f"{p} returns HTTP 200", False, str(e))
            check(f"{p} is well-formed JSON", False, "File not found")

    print(f"\nTotal Passed: {passed}, Total Failed: {failed}")
    if failed > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    run_audit()
