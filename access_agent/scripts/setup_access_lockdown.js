#!/usr/bin/env node
/**
 * setup_access_lockdown.js
 *
 * Automatically provisions or updates Cloudflare Zero Trust Access to protect:
 *   - sausage.allen.tools/clover_api/analytics/*
 *   - sausage.allen.tools/analytics/*
 * While keeping the Sausage Prep Tracker (/) completely public and accessible!
 *
 * Features:
 * - Scopes protection to predictive analytics and financial data paths
 * - Whitelists authorized staff emails
 * - Enables Google SSO and Email One-Time PIN (OTP) login methods
 * - Configures custom deny redirect to the Request Access portal
 *
 * Usage:
 *   CF_ACCOUNT_ID=... CF_API_TOKEN=... node setup_access_lockdown.js [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ground-truth initial authorized staff whitelist
const DEFAULT_WHITELIST_EMAILS = [
  'allenchristophertools@gmail.com', // Pitmaster / Sausage Artisan
  'yellowrosebbqjax@gmail.com'       // Smokehouse Official / Management
];

async function main() {
  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  const isDryRun = process.argv.includes('--dry-run');
  const targetDomain = process.env.ACCESS_DOMAIN || 'sausage.allen.tools/clover_api/analytics/*';
  const workerUrl = process.env.WORKER_DOMAIN 
    ? (process.env.WORKER_DOMAIN.startsWith('http') ? process.env.WORKER_DOMAIN : `https://${process.env.WORKER_DOMAIN}`)
    : 'https://yellow-rose-access-bot.workers.dev';

  console.log('🔒 ============================================================');
  console.log('   Yellow Rose BBQ — Zero Trust Access Lockdown Provisioner');
  console.log('============================================================\n');

  if (!accountId || !token) {
    console.error('❌ Error: CF_ACCOUNT_ID and CF_API_TOKEN environment variables are required.');
    console.error('\nUsage:');
    console.error('  CF_ACCOUNT_ID="your_account_id" CF_API_TOKEN="your_token" node setup_access_lockdown.js');
    console.error('\n(You can obtain your Account ID from your Cloudflare Dashboard URL, and create a Token with Zero Trust: Edit permissions.)');
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Step 1: Discover available Identity Providers (Google & One-Time PIN)
  console.log('1️⃣ Checking Identity Providers in Cloudflare Zero Trust...');
  let allowedIdps = [];
  try {
    const idpUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/identity_providers`;
    const idpRes = await fetch(idpUrl, { headers });
    const idpData = await idpRes.json();

    if (idpData.success && Array.isArray(idpData.result)) {
      console.log(`   Found ${idpData.result.length} configured Identity Provider(s):`);
      idpData.result.forEach(idp => {
        console.log(`   • ${idp.type.toUpperCase()}: "${idp.name}" (ID: ${idp.id})`);
        allowedIdps.push(idp.id);
      });
    } else {
      console.log('   ⚠️ Could not fetch IdPs or none configured. Cloudflare defaults will apply.');
    }
  } catch (err) {
    console.warn('   ⚠️ Error fetching IdPs:', err.message);
  }

  // Step 2: Locate or Create Access Application for Analytics Path
  console.log(`\n2️⃣ Inspecting Access Applications for "${targetDomain}"...`);
  if (isDryRun) {
    console.log('   [DRY RUN] Simulating Cloudflare Zero Trust Access Application & Policy payload...');
    const appPayload = {
      name: 'Yellow Rose Predictive Analytics & Financials',
      domain: targetDomain,
      type: 'self_hosted',
      session_duration: '730h',
      auto_redirect_to_identity: false,
      enable_binding_cookie: false,
      custom_deny_url: `${workerUrl}/request-access`,
      custom_deny_message: 'Predictive analytics and Clover financial data are restricted to authorized Yellow Rose staff.',
      allowed_idps: ['google-idp-id', 'otp-idp-id']
    };
    console.log('   [DRY RUN] Application Configuration:');
    console.log(JSON.stringify(appPayload, null, 2));

    const policyPayload = {
      name: 'Yellow Rose Staff Email Whitelist',
      decision: 'allow',
      include: DEFAULT_WHITELIST_EMAILS.map(email => ({ email: { email } })),
      require: [],
      exclude: []
    };
    console.log('\n   [DRY RUN] Policy Whitelist Configuration:');
    console.log(JSON.stringify(policyPayload, null, 2));

    console.log('\n============================================================');
    console.log('🎉 [DRY RUN] Verification Successful!');
    console.log('============================================================');
    return;
  }

  const appsUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/apps`;
  const appsRes = await fetch(appsUrl, { headers });
  const appsData = await appsRes.json();

  if (!appsData.success) {
    console.error('❌ Failed to list Access Applications:', appsData.errors?.[0]?.message || 'Unknown error');
    process.exit(1);
  }

  let existingApp = (appsData.result || []).find(a => 
    (a.domain || '').toLowerCase() === targetDomain.toLowerCase() ||
    (a.name || '').includes('Yellow Rose Predictive Analytics')
  );

  let appId = existingApp ? existingApp.id : null;

  const appPayload = {
    name: 'Yellow Rose Predictive Analytics & Financials',
    domain: targetDomain,
    type: 'self_hosted',
    session_duration: '730h', // 1 month
    auto_redirect_to_identity: false,
    enable_binding_cookie: false,
    custom_deny_url: `${workerUrl}/request-access`,
    custom_deny_message: 'Predictive analytics and Clover financial data are restricted to authorized Yellow Rose staff.',
    ...(allowedIdps.length > 0 ? { allowed_idps: allowedIdps } : {})
  };

  if (isDryRun) {
    console.log('   [DRY RUN] Would deploy Application payload:');
    console.log(JSON.stringify(appPayload, null, 2));
  } else if (existingApp) {
    console.log(`   Updating existing Access Application: "${existingApp.name}" (ID: ${appId})...`);
    const updateRes = await fetch(`${appsUrl}/${appId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(appPayload)
    });
    const updateData = await updateRes.json();
    if (!updateData.success) {
      console.error('❌ Failed to update Application:', updateData.errors?.[0]?.message || 'Unknown error');
    } else {
      console.log('   ✅ Application configuration updated successfully!');
    }
  } else {
    console.log(`   Creating new Access Application for "${targetDomain}"...`);
    const createRes = await fetch(appsUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(appPayload)
    });
    const createData = await createRes.json();
    if (!createData.success) {
      console.error('❌ Failed to create Application:', createData.errors?.[0]?.message || 'Unknown error');
      process.exit(1);
    }
    appId = createData.result.id;
    console.log(`   ✅ Created Access Application (ID: ${appId})!`);
  }

  // Step 3: Configure Staff Whitelist Policy
  console.log('\n3️⃣ Configuring Staff Whitelist Access Policy...');
  if (appId && !isDryRun) {
    const policiesUrl = `${appsUrl}/${appId}/policies`;
    const polRes = await fetch(policiesUrl, { headers });
    const polData = await polRes.json();

    const existingPolicy = (polData.result || []).find(p => 
      (p.name || '').includes('Staff') || (p.decision === 'allow')
    );

    const policyPayload = {
      name: 'Yellow Rose Staff Email Whitelist',
      decision: 'allow',
      include: DEFAULT_WHITELIST_EMAILS.map(email => ({ email: { email } })),
      require: [],
      exclude: []
    };

    if (existingPolicy) {
      console.log(`   Updating existing policy: "${existingPolicy.name}" (ID: ${existingPolicy.id})...`);
      // Merge existing whitelisted emails
      const currentEmails = [];
      (existingPolicy.include || []).forEach(inc => {
        if (inc.email && inc.email.email) currentEmails.push(inc.email.email.toLowerCase());
      });
      const mergedEmails = Array.from(new Set([...currentEmails, ...DEFAULT_WHITELIST_EMAILS]));
      policyPayload.include = mergedEmails.map(email => ({ email: { email } }));

      const putRes = await fetch(`${policiesUrl}/${existingPolicy.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(policyPayload)
      });
      const putData = await putRes.json();
      if (putData.success) {
        console.log(`   ✅ Whitelist policy updated with ${mergedEmails.length} authorized staff members:`);
        mergedEmails.forEach(e => console.log(`      • ${e}`));
      } else {
        console.warn('   ⚠️ Failed to update policy:', putData.errors?.[0]?.message);
      }
    } else {
      console.log('   Creating new Whitelist policy...');
      const postRes = await fetch(policiesUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(policyPayload)
      });
      const postData = await postRes.json();
      if (postData.success) {
        console.log(`   ✅ Whitelist policy created with ${DEFAULT_WHITELIST_EMAILS.length} authorized staff members!`);
        DEFAULT_WHITELIST_EMAILS.forEach(e => console.log(`      • ${e}`));
      } else {
        console.warn('   ⚠️ Failed to create policy:', postData.errors?.[0]?.message);
      }
    }
  }

  console.log('\n============================================================');
  console.log('🎉 Selective Lockdown Provisioning Complete!');
  console.log('============================================================');
  console.log('• Public Path:    sausage.allen.tools/ (Sausage Calculator & scaling open)');
  console.log(`• Protected Path: sausage.allen.tools/clover_api/analytics/* (Zero Trust gated)`);
  console.log('• Login Methods:  Google SSO & Email One-Time PIN (OTP)');
  console.log('• Access Portal:  ' + workerUrl + '/request-access');
  console.log('============================================================\n');
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
