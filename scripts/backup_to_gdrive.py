#!/usr/bin/env python3
"""
Yellow Rose BBQ - Google Drive Automated Backup Utility
Uses rclone to perform an incremental, bandwidth-efficient sync of the user's
GitHub projects directory (/home/atools/Documents/GitHub) to Google Drive.

Excludes heavy/disposable cache and virtualenv folders (.venv, node_modules, __pycache__).
Ensures the local master POS database (data/clover_sales_master.db) and project assets
are safely backed up offsite.

Usage:
    python scripts/backup_to_gdrive.py [--dry-run] [--remote REMOTE_PATH]
"""

import sys
import subprocess
import shutil
from pathlib import Path
from datetime import datetime

SOURCE_DIR = Path("/home/atools/Documents/GitHub")
DEFAULT_REMOTE = "gdrive:backups/GitHub_Projects"

EXCLUDES = [
    # Virtualenvs & dependencies
    ".venv/**",
    ".venv*/**",
    "venv/**",
    "node_modules/**",
    "**/node_modules/**",
    "**/.venv/**",
    "**/.venv*/**",
    
    # Python & runtime caches
    "__pycache__/**",
    "**/__pycache__/**",
    "*.pyc",
    ".pytest_cache/**",
    ".mypy_cache/**",
    ".ruff_cache/**",
    ".cache/**",
    
    # Large temporary/test results
    "test-results/**",
    "playwright-report/**",
    "**/.wrangler/tmp/**",
    
    # Chromium/browser binaries
    "**/browser_downloads/**",
    "**/playwright/**"
]

def check_rclone():
    rclone_path = shutil.which("rclone") or "/home/atools/.local/bin/rclone"
    if not Path(rclone_path).is_file():
        print(f"[ERROR] rclone binary not found at {rclone_path}. Please install rclone.")
        sys.exit(1)
    return rclone_path

def run_backup(dry_run=False, remote=DEFAULT_REMOTE):
    rclone_bin = check_rclone()
    print("=" * 65)
    print(" Yellow Rose BBQ — Google Drive Offsite Backup")
    print("=" * 65)
    print(f"Source: {SOURCE_DIR}")
    print(f"Destination: {remote}")
    print(f"Mode: {'DRY RUN (preview only)' if dry_run else 'LIVE INCREMENTAL SYNC'}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S EST')}")
    print("-" * 65)

    cmd = [
        rclone_bin,
        "sync",
        str(SOURCE_DIR),
        remote,
        "--verbose",
        "--stats", "10s",
        "--transfers", "4",
        "--checkers", "8",
    ]

    for pattern in EXCLUDES:
        cmd.extend(["--exclude", pattern])

    if dry_run:
        cmd.append("--dry-run")

    print(f"Executing: {' '.join(cmd[:4])} ... [with {len(EXCLUDES)} exclusion rules]")
    try:
        proc = subprocess.run(cmd, check=True)
        print("=" * 65)
        print("[SUCCESS] Backup to Google Drive completed successfully!")
        print("=" * 65)
        return proc.returncode
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Backup failed with exit code {e.returncode}", file=sys.stderr)
        return e.returncode

if __name__ == "__main__":
    is_dry = "--dry-run" in sys.argv
    remote_arg = DEFAULT_REMOTE
    for i, arg in enumerate(sys.argv):
        if arg == "--remote" and i + 1 < len(sys.argv):
            remote_arg = sys.argv[i + 1]

    exit_code = run_backup(dry_run=is_dry, remote=remote_arg)
    sys.exit(exit_code)
