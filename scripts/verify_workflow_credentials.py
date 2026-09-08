#!/usr/bin/env python3
import os
import sys
from pathlib import Path

# Add project root to path so we can import clover_api modules
project_root = Path(__file__).resolve().parent.parent
sys.path.append(str(project_root))

def run_dry_check():
    print("=== Maker-Checker: Verifying Clover Credentials ===")
    
    # Check if mock environment variables exist (or real ones)
    merchant_id = os.getenv("CLOVER_MERCHANT_ID")
    api_key = os.getenv("CLOVER_API_KEY")
    base_url = os.getenv("CLOVER_BASE_URL", "https://api.clover.com")

    if not merchant_id or merchant_id in ("", "YOUR_CLOVER_MERCHANT_ID_HERE"):
        print("[FAIL] CLOVER_MERCHANT_ID is missing or not set correctly.")
        return False

    if not api_key or api_key in ("", "YOUR_CLOVER_API_KEY_HERE"):
        print("[FAIL] CLOVER_API_KEY is missing or not set correctly.")
        return False

    print(f"[PASS] CLOVER_MERCHANT_ID mapped successfully (Length: {len(merchant_id)}).")
    print(f"[PASS] CLOVER_API_KEY mapped successfully (Length: {len(api_key)}).")
    print(f"[PASS] Base URL points to: {base_url}")
    print("=== Verification Successful ===")
    return True

if __name__ == "__main__":
    if run_dry_check():
        sys.exit(0)
    else:
        sys.exit(1)
