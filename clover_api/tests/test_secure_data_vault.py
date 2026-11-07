#!/usr/bin/env python3
"""Unit tests for the Confidential Data Vault & Encryption Utility."""

import os
from pathlib import Path
import stat
import tempfile
import unittest

from scripts.secure_data_vault import (
    audit_repository_security,
    compute_sha256,
    decrypt_archive,
    encrypt_archive,
    enforce_strict_permissions,
    get_vault_key,
    verify_archive,
)


class TestSecureDataVault(unittest.TestCase):
    def setUp(self):
        self.test_key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

    def test_permissions_enforced(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = Path(tmpdir) / "sensitive.csv"
            test_file.write_text("Customer 12345,Item,Price\n")
            # Set too open permissions
            test_file.chmod(0o666)

            enforce_strict_permissions(test_file, is_dir=False)
            mode = stat.S_IMODE(test_file.stat().st_mode)
            self.assertEqual(mode, 0o600)

            test_dir = Path(tmpdir) / "vault"
            test_dir.mkdir()
            test_dir.chmod(0o775)
            enforce_strict_permissions(test_dir, is_dir=True)
            dir_mode = stat.S_IMODE(test_dir.stat().st_mode)
            self.assertEqual(dir_mode, 0o700)

    def test_encrypt_decrypt_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            work_dir = Path(tmpdir)
            source_file = work_dir / "invoice_test.csv"
            source_file.write_text("CUSTOMER NUMBER,AMOUNT\n91714857,$1066.80\n")

            archive_path = work_dir / "test_vault.tar.gz.enc"
            encrypt_archive([source_file], archive_path, self.test_key, base_dir=work_dir)

            self.assertTrue(archive_path.is_file())
            # Ensure archive permissions are 0600
            archive_mode = stat.S_IMODE(archive_path.stat().st_mode)
            self.assertEqual(archive_mode, 0o600)

            # Test in-memory verify
            self.assertTrue(verify_archive(archive_path, self.test_key))

            # Test decrypt
            extract_dir = work_dir / "extracted"
            extracted_files = decrypt_archive(archive_path, extract_dir, self.test_key)
            self.assertEqual(len(extracted_files), 1)

            decrypted_content = (extract_dir / "invoice_test.csv").read_text()
            self.assertEqual(decrypted_content, "CUSTOMER NUMBER,AMOUNT\n91714857,$1066.80\n")

    def test_wrong_key_fails(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            work_dir = Path(tmpdir)
            source_file = work_dir / "secret.csv"
            source_file.write_text("top secret\n")

            archive_path = work_dir / "test_vault.tar.gz.enc"
            encrypt_archive([source_file], archive_path, self.test_key, base_dir=work_dir)

            bad_key = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
            with self.assertRaises(RuntimeError):
                decrypt_archive(archive_path, work_dir / "bad_extract", bad_key)

            self.assertFalse(verify_archive(archive_path, bad_key))

    def test_audit_repository_security(self):
        violations = audit_repository_security()
        self.assertEqual(violations, 0, f"Expected 0 security audit violations, found {violations}")


if __name__ == "__main__":
    unittest.main()
