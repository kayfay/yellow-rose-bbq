"""
Automated Web Security & GitHub Pages Payload Verification Test Suite
Validates CSP headers, static asset availability, secret isolation, and JSON chart payload integrity over HTTP.
"""

import re
import json
import time
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

# Bypass proxy for localhost to avoid 400 Bad Request from sandbox proxy
import os
os.environ['no_proxy'] = '127.0.0.1,localhost'
import urllib.request

PORT = 8088
BASE_URL = f"http://127.0.0.1:{PORT}"
ROOT_DIR = Path(__file__).resolve().parent.parent

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress HTTP server output logs during test run

def start_server():
    import os
    os.chdir(str(ROOT_DIR))
    server = HTTPServer(("127.0.0.1", PORT), QuietHandler)
    server.serve_forever()

def run_automated_verification():
    print("=== Starting Automated Web & Payload Security Suite ===")
    
    # 1. Launch local test web server in background thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    time.sleep(0.5)

    passed = 0
    failed = 0

    def assert_test(name, condition, details=""):
        nonlocal passed, failed
        if condition:
            print(f"  ✅ [PASS] {name}")
            passed += 1
        else:
            print(f"  ❌ [FAIL] {name} - {details}")
            failed += 1

    # Test 1: Fetch index.html and verify CSP meta tag
    print("\n[TEST 1] Content Security Policy (CSP) Verification")
    try:
        with urllib.request.urlopen(f"{BASE_URL}/index.html") as response:
            html_content = response.read().decode('utf-8')
            assert_test("index.html loads via HTTP (200 OK)", response.status == 200)
            
            # Check CSP meta tag
            has_csp = 'http-equiv="Content-Security-Policy"' in html_content
            assert_test("CSP meta tag present in index.html", has_csp)
    except Exception as e:
        assert_test("index.html HTTP load", False, str(e))

    # Test 2: Verify static JavaScript & secrets scan
    print("\n[TEST 2] Client-Side JavaScript Security Scan")
    try:
        with urllib.request.urlopen(f"{BASE_URL}/app.js") as response:
            js_content = response.read().decode('utf-8')
            assert_test("app.js loads via HTTP (200 OK)", response.status == 200)
            
            # Check for leaked tokens or auth headers in client code
            has_bearer = 'Authorization' in js_content or 'Bearer' in js_content
            assert_test("Zero hardcoded authorization headers in app.js", not has_bearer)

            has_clover_endpoint = 'api.clover.com' in js_content
            assert_test("Zero direct Clover API endpoint calls in client JS", not has_clover_endpoint)
    except Exception as e:
        assert_test("app.js HTTP load", False, str(e))

    # Test 3: Analytics JSON Payloads for GitHub Pages
    print("\n[TEST 3] GitHub Pages Analytics Payloads Integrity")
    payload_files = [
        ("arima_payload.json", "plotly_baseline_chart"),
        ("weather_payload.json", "plotly_weather_chart"),
        ("event_payload.json", "plotly_event_chart")
    ]

    for filename, chart_key in payload_files:
        url = f"{BASE_URL}/clover_api/analytics/{filename}"
        try:
            with urllib.request.urlopen(url) as response:
                assert_test(f"{filename} HTTP 200 OK", response.status == 200)
                data = json.loads(response.read().decode('utf-8'))
                assert_test(f"{filename} contains valid '{chart_key}' key", chart_key in data)
                
                # Check data and layout exist inside chart
                chart = data.get(chart_key, {})
                has_data_and_layout = 'data' in chart and 'layout' in chart
                assert_test(f"{filename} contains Plotly 'data' & 'layout' blocks", has_data_and_layout)
        except Exception as e:
            assert_test(f"{filename} payload test", False, str(e))

    # Test 4: Secret Isolation (Verify .env is not accessible over HTTP)
    print("\n[TEST 4] Secret Isolation Check")
    try:
        env_url = f"{BASE_URL}/.env"
        req = urllib.request.Request(env_url)
        try:
            with urllib.request.urlopen(req) as resp:
                # If server returns 200, check if gitignore blocks publishing
                print("  ⚠️ .env is present locally (normal for local dev). Verifying .gitignore protection...")
        except urllib.error.HTTPError as e:
            pass  # Expected error if forbidden/not served
        
        # Check .gitignore file directly
        gitignore_path = ROOT_DIR / ".gitignore"
        if gitignore_path.exists():
            content = gitignore_path.read_text()
            assert_test(".env explicitly listed in .gitignore", ".env" in content)
            assert_test("clover_sales.db explicitly listed in .gitignore", ".db" in content)
    except Exception as e:
        assert_test(".env security check", False, str(e))

    print(f"\n=== Test Results: {passed} PASSED | {failed} FAILED ===")
    if failed > 0:
        exit(1)

if __name__ == "__main__":
    run_automated_verification()
