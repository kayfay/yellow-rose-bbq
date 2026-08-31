"""
Clover POS API Integration - Secure Configuration Module
Dynamically loads credentials from .env via python-dotenv and enforces strict runtime validation.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"

if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)
else:
    load_dotenv()

CLOVER_BASE_URL = os.getenv("CLOVER_BASE_URL", "https://api.clover.com").rstrip("/")
CLOVER_MERCHANT_ID = os.getenv("CLOVER_MERCHANT_ID")
CLOVER_API_KEY = os.getenv("CLOVER_API_KEY")

def get_secure_credentials():
    """
    Validates and returns Clover credentials.
    Raises RuntimeError if required environment variables are missing or using placeholders.
    """
    missing = []
    if not CLOVER_MERCHANT_ID or CLOVER_MERCHANT_ID in ("", "YOUR_CLOVER_MERCHANT_ID_HERE"):
        missing.append("CLOVER_MERCHANT_ID")
    if not CLOVER_API_KEY or CLOVER_API_KEY in ("", "YOUR_CLOVER_API_KEY_HERE"):
        missing.append("CLOVER_API_KEY")

    if missing:
        error_msg = (
            f"[SECURITY ERROR] Missing required Clover API credential(s): {', '.join(missing)}. "
            f"Please configure {ENV_PATH} with your Merchant ID and API Key."
        )
        sys.stderr.write(error_msg + "\n")
        raise RuntimeError(error_msg)

    return {
        "base_url": CLOVER_BASE_URL,
        "merchant_id": CLOVER_MERCHANT_ID,
        "api_key": CLOVER_API_KEY,
    }

def get_headers():
    """Returns secure authorization headers for Clover REST API v3 calls."""
    creds = get_secure_credentials()
    return {
        "Authorization": f"Bearer {creds['api_key']}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

DATA_DIR = BASE_DIR / "data"
ANALYTICS_DIR = BASE_DIR / "analytics"
DB_PATH = DATA_DIR / "clover_sales.db"

DATA_DIR.mkdir(parents=True, exist_ok=True)
ANALYTICS_DIR.mkdir(parents=True, exist_ok=True)
