"""
Clover POS API Integration - Configuration Module
Secures credentials via environment variables loaded from .env.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Automatically locate and load .env file in the current directory or parent directory
BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"

if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)
else:
    load_dotenv()  # Fallback to default environment lookup

CLOVER_MERCHANT_ID = os.getenv("CLOVER_MERCHANT_ID")
CLOVER_API_KEY = os.getenv("CLOVER_API_KEY")
CLOVER_BASE_URL = os.getenv("CLOVER_BASE_URL", "https://api.clover.com").rstrip("/")

def validate_config():
    """Validates that required Clover API credentials are present in the environment."""
    missing = []
    if not CLOVER_MERCHANT_ID or CLOVER_MERCHANT_ID == "YOUR_CLOVER_MERCHANT_ID_HERE":
        missing.append("CLOVER_MERCHANT_ID")
    if not CLOVER_API_KEY or CLOVER_API_KEY == "YOUR_CLOVER_API_KEY_HERE":
        missing.append("CLOVER_API_KEY")

    if missing:
        raise ValueError(
            f"Missing required Clover API credentials: {', '.join(missing)}. "
            f"Please set them in {ENV_PATH} or export them in your environment."
        )

def get_headers():
    """Returns authorization headers for Clover REST API v3 calls."""
    validate_config()
    return {
        "Authorization": f"Bearer {CLOVER_API_KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

# Data storage paths
DATA_DIR = BASE_DIR / "data"
ANALYTICS_DIR = BASE_DIR / "analytics"
DB_PATH = DATA_DIR / "clover_sales.db"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
ANALYTICS_DIR.mkdir(parents=True, exist_ok=True)
