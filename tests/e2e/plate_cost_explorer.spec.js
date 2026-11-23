const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

function readLocalVaultKey() {
  if (process.env.PLATE_VAULT_PASSPHRASE) return process.env.PLATE_VAULT_PASSPHRASE.trim();
  if (process.env.DATA_VAULT_KEY) return process.env.DATA_VAULT_KEY.trim();
  const envPath = path.resolve(__dirname, '../../.env');
  if (!fs.existsSync(envPath)) return null;
  const envMap = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    for (const k of ['PLATE_VAULT_PASSPHRASE', 'DATA_VAULT_KEY']) {
      if (t.startsWith(k + '=')) {
        let v = t.slice(k.length + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (v) envMap[k] = v;
      }
    }
  }
  return envMap.PLATE_VAULT_PASSPHRASE || envMap.DATA_VAULT_KEY || null;
}

test.describe('Plate & Recipe Costs Subtab — Encrypted Owner Vault & Fuzzy Search', () => {
  test('starts locked by default with zero plaintext exposed, rejects wrong passphrase, and unlocks cleanly on mobile (390px)', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.click('.mobile-bottom-nav-btn[data-tab="forecasting-analytics"]');
    await page.click('#btn-subtab-plate-costs');

    const view = page.locator('#subtab-view-plate-costs');
    await expect(view).toBeVisible();

    // 1. Vault must start locked with zero plaintext menu/recipe costs visible
    await expect(page.locator('#plate-vault-lock-gate')).toBeVisible();
    await expect(page.locator('#plate-vault-unlocked-content')).toBeHidden();

    // 2. Wrong passphrase fails cleanly
    await page.fill('#plate-vault-passphrase', 'wrong-passphrase-123');
    await page.click('#btn-plate-vault-unlock');
    await expect(page.locator('#plate-vault-error')).toBeVisible();
    await expect(page.locator('#plate-vault-unlocked-content')).toBeHidden();

    // 3. Unlock with local DATA_VAULT_KEY when available (CI without .env still verifies lock gate above)
    const vaultKey = readLocalVaultKey();
    if (vaultKey) {
      await page.fill('#plate-vault-passphrase', vaultKey);
      await page.click('#btn-plate-vault-unlock');
      await expect(page.locator('#plate-vault-unlocked-content')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#plate-vault-lock-gate')).toBeHidden();

      // Category Rollup Cards (8 categories, zero wide tables)
      await expect(view.locator('.plate-cat-card')).toHaveCount(8);
      expect(await view.locator('table').count()).toBe(0);

      // Fuzzy search handles typos ("brskt" -> Brisket, "banna puding" -> Banana Pudding)
      const search = page.locator('#plate-fuzzy-search');
      await search.fill('brskt');
      await expect(view.locator('.plate-item-title').first()).toContainText(/Brisket/i);

      await search.fill('banna puding');
      await expect(view.locator('.plate-item-title').first()).toContainText(/Banana Pudding/i);

      // Lock button wipes decrypted state and restores lock gate
      await page.click('#btn-plate-vault-lock');
      await expect(page.locator('#plate-vault-lock-gate')).toBeVisible();
      await expect(page.locator('#plate-vault-unlocked-content')).toBeHidden();
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow).toBe(false);
    expect(consoleErrors).toEqual([]);
  });
});
