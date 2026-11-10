#!/usr/bin/env python3
"""
Yellow Rose BBQ - Bitwarden Automated Key Saver
Collects all project secrets (DATA_VAULT_KEY, CLOVER_MERCHANT_ID, CLOVER_API_KEY,
TELEGRAM credentials) from local .env files, unlocks the local Bitwarden vault,
and creates a secure note entry titled 'Yellow Rose BBQ - Master Secrets & Clover POS'.

Usage:
    python scripts/save_to_bitwarden.py
"""

import os
import sys
import json
import getpass
import subprocess
import shutil
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ROOT_ENV = REPO_ROOT / ".env"
CLOVER_ENV = REPO_ROOT / "clover_api" / ".env"

def parse_env_file(path: Path) -> dict:
    values = {}
    if not path.is_file():
        return values
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            values[k.strip()] = v.strip().strip('"').strip("'")
    return values

def get_bw_session():
    # Check if BW_SESSION already set in environment
    if os.environ.get("BW_SESSION"):
        return os.environ["BW_SESSION"]

    bw_bin = shutil.which("bw") or "/home/atools/.local/bin/bw"
    if not Path(bw_bin).is_file():
        print(f"[ERROR] Bitwarden CLI (bw) not found at {bw_bin}.", file=sys.stderr)
        sys.exit(1)

    # Check status
    res = subprocess.run([bw_bin, "status"], capture_output=True, text=True)
    try:
        status_data = json.loads(res.stdout)
    except Exception:
        status_data = {}

    status = status_data.get("status")
    if status == "unauthenticated":
        print("[AUTH NEEDED] Bitwarden is not logged in. Logging in...")
        email = input("Bitwarden Email: ").strip()
        subprocess.run([bw_bin, "login", email], check=True)

    print("-" * 65)
    print("Bitwarden vault is locked.")
    print("Enter your Bitwarden Master Password to save these keys into your vault:")
    password = getpass.getpass("Master Password: ")
    if not password:
        print("[ERROR] Password cannot be empty.", file=sys.stderr)
        sys.exit(1)

    unlock_res = subprocess.run(
        [bw_bin, "unlock", password, "--raw"],
        capture_output=True,
        text=True
    )

    if unlock_res.returncode != 0:
        print(f"[ERROR] Failed to unlock Bitwarden vault: {unlock_res.stderr.strip()}", file=sys.stderr)
        sys.exit(1)

    session_key = unlock_res.stdout.strip()
    return session_key

def main():
    bw_bin = shutil.which("bw") or "/home/atools/.local/bin/bw"
    print("=" * 65)
    print(" Yellow Rose BBQ — Bitwarden Automated Secret Saver")
    print("=" * 65)

    root_keys = parse_env_file(ROOT_ENV)
    clover_keys = parse_env_file(CLOVER_ENV)

    data_vault_key = root_keys.get("DATA_VAULT_KEY", "NOT_FOUND")
    clover_merchant_id = clover_keys.get("CLOVER_MERCHANT_ID", "NOT_FOUND")
    clover_api_key = clover_keys.get("CLOVER_API_KEY", "NOT_FOUND")
    clover_base_url = clover_keys.get("CLOVER_BASE_URL", "https://api.clover.com")
    telegram_bot_token = root_keys.get("TELEGRAM_BOT_TOKEN", clover_keys.get("TELEGRAM_BOT_TOKEN", "NOT_FOUND"))
    telegram_chat_id = root_keys.get("TELEGRAM_CHAT_ID", clover_keys.get("TELEGRAM_CHAT_ID", "NOT_FOUND"))

    print(f"Found DATA_VAULT_KEY:       {'[LOADED]' if data_vault_key != 'NOT_FOUND' else '[MISSING]'}")
    print(f"Found CLOVER_MERCHANT_ID:   {'[LOADED]' if clover_merchant_id != 'NOT_FOUND' else '[MISSING]'}")
    print(f"Found CLOVER_API_KEY:       {'[LOADED]' if clover_api_key != 'NOT_FOUND' else '[MISSING]'}")
    print(f"Found TELEGRAM_CHAT_ID:     {'[LOADED]' if telegram_chat_id != 'NOT_FOUND' else '[MISSING]'}")

    note_body = f"""Yellow Rose BBQ - Master Production Secrets & Disaster Recovery Keys
Generated from yellow-rose-bbq repository environment.

1. DATA VAULT AES-256 KEY (Disaster Recovery for Encrypted Backups):
DATA_VAULT_KEY={data_vault_key}

2. CLOVER POS PRODUCTION CREDENTIALS:
CLOVER_BASE_URL={clover_base_url}
CLOVER_MERCHANT_ID={clover_merchant_id}
CLOVER_API_KEY={clover_api_key}

3. TELEGRAM BOT NOTIFICATIONS:
TELEGRAM_BOT_TOKEN={telegram_bot_token}
TELEGRAM_CHAT_ID={telegram_chat_id}

Note: If this computer is ever replaced, use DATA_VAULT_KEY to decrypt backups/*.tar.gz.enc
and restore the full master POS sales database and vendor records.
"""

    session_key = get_bw_session()

    # Encode note into Bitwarden item JSON
    # Type 2 is Secure Note in Bitwarden
    # Use bw encode to format correctly
    note_template = {
        "type": 2,
        "name": "Yellow Rose BBQ - Master Secrets & Clover POS",
        "notes": note_body,
        "secureNote": {
            "type": 0
        },
        "fields": [
            {"name": "DATA_VAULT_KEY", "value": data_vault_key, "type": 1},
            {"name": "CLOVER_MERCHANT_ID", "value": clover_merchant_id, "type": 0},
            {"name": "CLOVER_API_KEY", "value": clover_api_key, "type": 1},
            {"name": "TELEGRAM_CHAT_ID", "value": telegram_chat_id, "type": 0}
        ]
    }

    raw_json = json.dumps(note_template)
    encode_res = subprocess.run([bw_bin, "encode"], input=raw_json, capture_output=True, text=True, check=True)
    encoded_b64 = encode_res.stdout.strip()

    print("[SYNC] Creating Secure Note in Bitwarden vault...")
    create_res = subprocess.run(
        [bw_bin, "create", "item", encoded_b64, "--session", session_key],
        capture_output=True,
        text=True
    )

    if create_res.returncode == 0:
        print("=" * 65)
        print("[SUCCESS] All keys and Clover credentials saved to Bitwarden!")
        print("Item Name: 'Yellow Rose BBQ - Master Secrets & Clover POS'")
        print("=" * 65)
    else:
        print(f"[ERROR] Failed to create item in Bitwarden: {create_res.stderr.strip()}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
