#!/usr/bin/env node
/**
 * Encrypts local plaintext plate_cost_explorer.json into client-side decryptable
 * AES-256-GCM ciphertext (clover_api/analytics/plate_cost_vault.enc.json) using
 * DATA_VAULT_KEY from .env (PBKDF2-HMAC-SHA256, 310,000 iterations).
 * Never prints, logs, or embeds the passphrase or plaintext financial data.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(__dirname, '..');
const ENV_PATH = path.join(BASE_DIR, '.env');
const SRC_JSON = path.join(BASE_DIR, 'clover_api', 'analytics', 'plate_cost_explorer.json');
const OUT_ENC = path.join(BASE_DIR, 'clover_api', 'analytics', 'plate_cost_vault.enc.json');

function loadVaultKey() {
  if (process.env.DATA_VAULT_KEY) return process.env.DATA_VAULT_KEY.trim();
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error('Missing .env file containing DATA_VAULT_KEY');
  }
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('DATA_VAULT_KEY=')) {
      let val = trimmed.slice('DATA_VAULT_KEY='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (val) return val;
    }
  }
  throw new Error('DATA_VAULT_KEY not found in .env');
}

function main() {
  if (!fs.existsSync(SRC_JSON)) {
    throw new Error(`Missing plaintext source: ${SRC_JSON}`);
  }
  const passphrase = loadVaultKey();
  const plaintext = fs.readFileSync(SRC_JSON, 'utf8');

  const iterations = 310000;
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(passphrase, salt, iterations, 32, 'sha256');

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encBuf = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Web Crypto API expects ciphertext || 16-byte authTag concatenated
  const combined = Buffer.concat([encBuf, authTag]);

  const payload = {
    v: 1,
    alg: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations,
    salt_b64: salt.toString('base64'),
    iv_b64: iv.toString('base64'),
    ciphertext_b64: combined.toString('base64'),
  };

  fs.writeFileSync(OUT_ENC, JSON.stringify(payload, null, 2) + '\n', { mode: 0o644 });
  console.log(`[VAULT] Encrypted plate_cost_explorer.json -> ${path.relative(BASE_DIR, OUT_ENC)} (AES-256-GCM, ${combined.length} bytes ciphertext)`);
}

main();
