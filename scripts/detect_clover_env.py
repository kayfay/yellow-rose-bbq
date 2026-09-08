#!/usr/bin/env python3
import os
import sys
import requests

def detect_environment():
    api_key = os.getenv("CLOVER_API_KEY")
    merchant_id = os.getenv("CLOVER_MERCHANT_ID")

    if not api_key or not merchant_id:
        print("::error::Missing CLOVER_API_KEY or CLOVER_MERCHANT_ID in environment.")
        sys.exit(1)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json"
    }

    environments = {
        "PRODUCTION": "https://api.clover.com",
        "SANDBOX": "https://sandbox.dev.clover.com"
    }

    for env_name, base_url in environments.items():
        test_url = f"{base_url}/v3/merchants/{merchant_id}/orders?limit=1"
        try:
            resp = requests.get(test_url, headers=headers, timeout=10)
            if resp.status_code == 200:
                print(f"[SUCCESS] Token is valid for {env_name} environment.")
                # Write to GitHub Actions environment file
                env_file = os.getenv("GITHUB_ENV")
                if env_file:
                    with open(env_file, "a") as f:
                        f.write(f"CLOVER_BASE_URL={base_url}\n")
                else:
                    print(f"export CLOVER_BASE_URL={base_url}")
                return
        except Exception as e:
            pass

    print("::error title=Token Validation Failed::The provided CLOVER_API_KEY and CLOVER_MERCHANT_ID did not work in Production or Sandbox. Please verify your credentials in GitHub Secrets.")
    sys.exit(1)

if __name__ == "__main__":
    print("=== Auto-detecting Clover API Environment ===")
    detect_environment()
