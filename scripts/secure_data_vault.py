#!/usr/bin/env python3
"""Yellow Rose BBQ - Confidential Data Vault & Encryption Utility.

Provides AES-256-CBC authenticated-strength encryption, verification, and audit
procedures for proprietary vendor invoices, COGS data, and customer account sheets.

Usage:
    python scripts/secure_data_vault.py encrypt [--input FILES...] [--output PATH]
    python scripts/secure_data_vault.py decrypt --input ARCHIVE_PATH --out-dir PATH
    python scripts/secure_data_vault.py verify [--input ARCHIVE_PATH]
    python scripts/secure_data_vault.py audit
"""

from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
import stat
import subprocess
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = REPO_ROOT / ".env"
BACKUPS_DIR = REPO_ROOT / "backups"
DATA_DIR = REPO_ROOT / "data"
VENDOR_INVOICES_DIR = DATA_DIR / "vendor_invoices"


def get_vault_key(custom_key: str | None = None) -> str:
    """Retrieve vault key from CLI arg, environment, or .env file."""
    if custom_key:
        return custom_key
    if "DATA_VAULT_KEY" in os.environ:
        return os.environ["DATA_VAULT_KEY"]
    if ENV_PATH.is_file():
        try:
            with open(ENV_PATH, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("DATA_VAULT_KEY="):
                        val = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if val:
                            return val
        except Exception as exc:
            print(f"[WARN] Could not read .env: {exc}", file=sys.stderr)
    raise ValueError(
        "DATA_VAULT_KEY not found in arguments, environment, or .env. "
        "Generate one with `openssl rand -hex 32` and set DATA_VAULT_KEY in .env."
    )


def compute_sha256(path: Path) -> str:
    """Compute sha256 checksum of a file."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def enforce_strict_permissions(path: Path, is_dir: bool = False) -> None:
    """Enforce strict chmod 0600 on sensitive files or 0700 on sensitive directories."""
    target_mode = stat.S_IRUSR | stat.S_IWUSR | (stat.S_IXUSR if is_dir else 0)
    try:
        current_mode = stat.S_IMODE(path.stat().st_mode)
        if current_mode != target_mode:
            path.chmod(target_mode)
    except Exception as exc:
        print(f"[WARN] Could not chmod {path}: {exc}", file=sys.stderr)


def encrypt_archive(
    files: list[Path], output_path: Path, key: str, base_dir: Path | None = None
) -> Path:
    """Pack files into tar.gz and encrypt via OpenSSL AES-256-CBC with PBKDF2."""
    if not files:
        raise ValueError("No input files provided to encrypt.")

    for f in files:
        if not f.exists():
            raise FileNotFoundError(f"Input file not found: {f}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    enforce_strict_permissions(output_path.parent, is_dir=True)

    # Relative paths for tar
    base = base_dir or REPO_ROOT
    rel_files = [str(f.resolve().relative_to(base.resolve())) for f in files]

    env = os.environ.copy()
    env["VAULT_PASS"] = key

    tar_cmd = ["tar", "-czf", "-", "-C", str(base)] + rel_files
    enc_cmd = [
        "openssl",
        "enc",
        "-aes-256-cbc",
        "-pbkdf2",
        "-iter",
        "100000",
        "-salt",
        "-pass",
        "env:VAULT_PASS",
        "-out",
        str(output_path),
    ]

    tar_proc = subprocess.Popen(tar_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    enc_proc = subprocess.Popen(
        enc_cmd,
        stdin=tar_proc.stdout,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
    )
    if tar_proc.stdout:
        tar_proc.stdout.close()

    enc_out, enc_err = enc_proc.communicate()
    tar_out, tar_err = tar_proc.communicate()

    if tar_proc.returncode != 0:
        raise RuntimeError(f"tar packaging failed: {tar_err.decode().strip()}")
    if enc_proc.returncode != 0:
        raise RuntimeError(f"openssl encryption failed: {enc_err.decode().strip()}")

    enforce_strict_permissions(output_path, is_dir=False)
    print(f"[VAULT] Successfully created encrypted archive: {output_path}")
    print(f"[VAULT] Archive SHA-256: {compute_sha256(output_path)}")
    print(f"[VAULT] Files archived ({len(files)}):")
    for rf in rel_files:
        print(f"  • {rf}")

    return output_path


def decrypt_archive(archive_path: Path, out_dir: Path, key: str) -> list[Path]:
    """Decrypt and unpack an encrypted tar.gz archive into out_dir."""
    if not archive_path.is_file():
        raise FileNotFoundError(f"Encrypted archive not found: {archive_path}")

    out_dir.mkdir(parents=True, exist_ok=True)
    enforce_strict_permissions(out_dir, is_dir=True)

    env = os.environ.copy()
    env["VAULT_PASS"] = key

    dec_cmd = [
        "openssl",
        "enc",
        "-d",
        "-aes-256-cbc",
        "-pbkdf2",
        "-iter",
        "100000",
        "-pass",
        "env:VAULT_PASS",
        "-in",
        str(archive_path),
    ]
    tar_cmd = ["tar", "-xzf", "-", "-C", str(out_dir)]

    dec_proc = subprocess.Popen(
        dec_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env
    )
    tar_proc = subprocess.Popen(
        tar_cmd, stdin=dec_proc.stdout, stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    if dec_proc.stdout:
        dec_proc.stdout.close()

    tar_out, tar_err = tar_proc.communicate()
    dec_out, dec_err = dec_proc.communicate()

    if dec_proc.returncode != 0:
        raise RuntimeError(f"Decryption failed: {dec_err.decode().strip()}")
    if tar_proc.returncode != 0:
        raise RuntimeError(f"tar extraction failed: {tar_err.decode().strip()}")

    extracted_files: list[Path] = []
    for root, dirs, files in os.walk(out_dir):
        for d in dirs:
            enforce_strict_permissions(Path(root) / d, is_dir=True)
        for f in files:
            fp = Path(root) / f
            enforce_strict_permissions(fp, is_dir=False)
            extracted_files.append(fp)

    print(f"[VAULT] Decrypted {len(extracted_files)} files to {out_dir}")
    return extracted_files


def verify_archive(archive_path: Path, key: str) -> bool:
    """Verify archive integrity by decrypting in-memory and testing tar manifest."""
    if not archive_path.is_file():
        raise FileNotFoundError(f"Encrypted archive not found: {archive_path}")

    env = os.environ.copy()
    env["VAULT_PASS"] = key

    dec_cmd = [
        "openssl",
        "enc",
        "-d",
        "-aes-256-cbc",
        "-pbkdf2",
        "-iter",
        "100000",
        "-pass",
        "env:VAULT_PASS",
        "-in",
        str(archive_path),
    ]
    tar_cmd = ["tar", "-tzv", "-f", "-"]

    dec_proc = subprocess.Popen(
        dec_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env
    )
    tar_proc = subprocess.Popen(
        tar_cmd, stdin=dec_proc.stdout, stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    if dec_proc.stdout:
        dec_proc.stdout.close()

    tar_out, tar_err = tar_proc.communicate()
    dec_out, dec_err = dec_proc.communicate()

    if dec_proc.returncode != 0:
        print(f"[ERROR] Decryption verification failed: {dec_err.decode().strip()}")
        return False
    if tar_proc.returncode != 0:
        print(f"[ERROR] tar verification failed: {tar_err.decode().strip()}")
        return False

    manifest = tar_out.decode("utf-8", errors="replace").strip().splitlines()
    print(f"[VAULT] Verification SUCCESSFUL: {archive_path.name}")
    print(f"[VAULT] Archive contains {len(manifest)} valid files/entries:")
    for line in manifest:
        print(f"  {line}")
    return True


def audit_repository_security() -> int:
    """Audit repository security posture for data privacy and permissions."""
    print("==================================================")
    print(" Yellow Rose BBQ — Security & Data Privacy Audit  ")
    print("==================================================")
    violations = 0

    # 1. Check for unorganized vendor invoice files in root
    raw_root_invoices = list(REPO_ROOT.glob("YRBBQ*")) + list(
        REPO_ROOT.glob("*Cust91714857*")
    )
    root_invoices = sorted(list({p.resolve() for p in raw_root_invoices}))
    if root_invoices:
        print(
            f"[WARN] Found {len(root_invoices)} vendor invoice file(s) in repository root:"
        )
        for f in root_invoices:
            print(f"  • {f.name}")
        violations += 1
    else:
        print("[PASS] Root directory clean: no stray vendor invoices in root.")

    # 2. Check for tracked confidential files in git index
    res = subprocess.run(
        ["git", "ls-files"], cwd=REPO_ROOT, stdout=subprocess.PIPE, text=True
    )
    tracked_files = res.stdout.splitlines() if res.returncode == 0 else []
    banned_tracked = [
        f
        for f in tracked_files
        if f.endswith((".csv", ".xlsx", ".xls", ".db", ".sqlite", ".enc"))
        or "YRBBQ" in f
        or "Cust91714857" in f
    ]
    if banned_tracked:
        print(
            f"[FAIL] Sensitive files tracked in git ({len(banned_tracked)}):",
            file=sys.stderr,
        )
        for bf in banned_tracked:
            print(f"  • {bf}", file=sys.stderr)
        violations += 1
    else:
        print("[PASS] Git index clean: zero confidential data files tracked.")

    # 3. Check permissions on .env
    if ENV_PATH.exists():
        mode = stat.S_IMODE(ENV_PATH.stat().st_mode)
        if mode != (stat.S_IRUSR | stat.S_IWUSR):
            print(f"[WARN] .env permissions are {oct(mode)}, expected 0600. Fixing...")
            enforce_strict_permissions(ENV_PATH, is_dir=False)
        else:
            print("[PASS] .env permissions verified: 0600.")
    else:
        print("[INFO] No .env file present.")

    # 4. Check permissions on sensitive data files in data/
    sensitive_patterns = ["*.csv", "*.xlsx", "*.db", "*.sqlite", "*.enc"]
    unlocked_files = []
    for pattern in sensitive_patterns:
        for p in DATA_DIR.rglob(pattern):
            mode = stat.S_IMODE(p.stat().st_mode)
            if mode & (stat.S_IRGRP | stat.S_IWGRP | stat.S_IROTH | stat.S_IWOTH):
                unlocked_files.append(p)
                enforce_strict_permissions(p, is_dir=False)

    for p in BACKUPS_DIR.rglob("*.enc"):
        mode = stat.S_IMODE(p.stat().st_mode)
        if mode & (stat.S_IRGRP | stat.S_IWGRP | stat.S_IROTH | stat.S_IWOTH):
            unlocked_files.append(p)
            enforce_strict_permissions(p, is_dir=False)

    if unlocked_files:
        print(
            f"[REMEDIATED] Hardened permissions to 0600 on {len(unlocked_files)} file(s)."
        )
    else:
        print("[PASS] File permissions on sensitive data verified (0600).")

    # 5. Check backups directory permissions
    if BACKUPS_DIR.exists():
        mode = stat.S_IMODE(BACKUPS_DIR.stat().st_mode)
        if mode & (stat.S_IROTH | stat.S_IWOTH):
            print(
                f"[WARN] backups/ directory permissions {oct(mode)} are too open. Hardening to 0700..."
            )
            enforce_strict_permissions(BACKUPS_DIR, is_dir=True)
        else:
            print("[PASS] backups/ directory permissions verified.")

    print("==================================================")
    if violations == 0:
        print(" Security Posture: COMPLIANT (0 critical violations)")
    else:
        print(f" Security Posture: {violations} action item(s) flagged")
    print("==================================================")
    return violations


def main() -> int:
    parser = argparse.ArgumentParser(description="Yellow Rose BBQ Data Vault")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # encrypt
    enc_parser = subparsers.add_parser("encrypt", help="Encrypt confidential files")
    enc_parser.add_argument(
        "--input",
        nargs="+",
        help="Input files to encrypt (defaults to new YRBBQ files)",
    )
    enc_parser.add_argument("--output", help="Output path for encrypted archive")
    enc_parser.add_argument("--key", help="Vault encryption key (overrides .env)")

    # decrypt
    dec_parser = subparsers.add_parser("decrypt", help="Decrypt encrypted archive")
    dec_parser.add_argument(
        "--input", required=True, help="Encrypted archive path (.enc)"
    )
    dec_parser.add_argument(
        "--out-dir", required=True, help="Destination directory for decrypted files"
    )
    dec_parser.add_argument("--key", help="Vault encryption key (overrides .env)")

    # verify
    ver_parser = subparsers.add_parser(
        "verify", help="Verify encrypted archive integrity"
    )
    ver_parser.add_argument(
        "--input", help="Encrypted archive path (defaults to latest in backups/)"
    )
    ver_parser.add_argument("--key", help="Vault encryption key (overrides .env)")

    # audit
    subparsers.add_parser(
        "audit", help="Audit repository file privacy and permissions"
    )

    args = parser.parse_args()

    if args.command == "audit":
        return audit_repository_security()

    key = get_vault_key(args.key)

    if args.command == "encrypt":
        if args.input:
            input_files = [Path(p).resolve() for p in args.input]
        else:
            # Default to all YRBBQ files in root or data/vendor_invoices
            input_files = (
                list(REPO_ROOT.glob("YRBBQ*"))
                + list(VENDOR_INVOICES_DIR.glob("YRBBQ*"))
                + list(DATA_DIR.glob("Submitted_Order*"))
                + list(DATA_DIR.glob("Review order detail*"))
            )
            # Deduplicate by resolve()
            input_files = sorted(list({p.resolve() for p in input_files}))

        if not input_files:
            print("[ERROR] No confidential files found to encrypt.")
            return 1

        output_path = Path(
            args.output
            or (BACKUPS_DIR / "yrbbq_vendor_data_encrypted_20261107.tar.gz.enc")
        )
        encrypt_archive(input_files, output_path, key)
        return 0

    if args.command == "decrypt":
        archive_path = Path(args.input)
        out_dir = Path(args.out_dir)
        decrypt_archive(archive_path, out_dir, key)
        return 0

    if args.command == "verify":
        if args.input:
            archive_path = Path(args.input)
        else:
            enc_archives = sorted(BACKUPS_DIR.glob("*.enc"), key=os.path.getmtime)
            if not enc_archives:
                print(f"[ERROR] No .enc archives found in {BACKUPS_DIR}")
                return 1
            archive_path = enc_archives[-1]

        success = verify_archive(archive_path, key)
        return 0 if success else 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
