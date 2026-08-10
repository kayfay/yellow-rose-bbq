"""
Clover POS API - Quick Credential Diagnostic Tool
Tests your API Token & Merchant ID against Clover API endpoints to pinpoint 401/403/404 issues.
"""

import sys
import requests
from clover_api.secure_config import get_secure_credentials, get_headers

def test_clover_credentials():
    print("=== Testing Clover API Credentials ===")
    try:
        creds = get_secure_credentials()
        headers = get_headers()
    except Exception as e:
        print(f"[FAIL] Configuration Error: {e}")
        return

    m_id = creds["merchant_id"]
    base_url = creds["base_url"]
    
    print(f"[INFO] Target Merchant ID: {m_id}")
    print(f"[INFO] Target Base URL:    {base_url}")
    print(f"[INFO] Token Preview:      {creds['api_key'][:4]}...{creds['api_key'][-4:] if len(creds['api_key'])>8 else ''}")
    
    # 1. Test Merchant Endpoint
    m_url = f"{base_url}/v3/merchants/{m_id}"
    print(f"\n[TEST 1] Fetching Merchant info: GET {m_url}")
    res1 = requests.get(m_url, headers=headers, timeout=15)
    if res1.status_code == 200:
        m_data = res1.json()
        print(f"  ✅ SUCCESS! Business Name: '{m_data.get('name')}'")
    else:
        print(f"  ❌ FAILED with Status Code {res1.status_code}: {res1.text[:200]}")
        if res1.status_code == 401:
            print("  👉 Cause: Invalid API Token or Token lacks access to this Merchant ID.")
        elif res1.status_code == 404:
            print("  👉 Cause: Merchant ID not found. Check if the mID is correct in .env.")
        return

    # 2. Test Orders Endpoint
    o_url = f"{base_url}/v3/merchants/{m_id}/orders?limit=1"
    print(f"\n[TEST 2] Testing Orders permission: GET {o_url}")
    res2 = requests.get(o_url, headers=headers, timeout=15)
    if res2.status_code == 200:
        print("  ✅ SUCCESS! API key has 'Read Orders' permission.")
    else:
        print(f"  ❌ FAILED with Status Code {res2.status_code}: {res2.text[:200]}")
        if res2.status_code == 403 or res2.status_code == 401:
            print("  👉 Cause: API key is missing 'Read Orders' permission in Clover Developer Dashboard.")

    print("\n=== Diagnostic Complete ===")

if __name__ == "__main__":
    test_clover_credentials()
