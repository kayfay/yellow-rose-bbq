#!/usr/bin/env node
/**
 * configure_login_screen.js
 * 
 * Automatically configures Cloudflare Zero Trust Access so that the "Request Access"
 * button and form present themselves directly on the login screen where email authentication
 * is requested.
 * 
 * Usage:
 *   CF_ACCOUNT_ID=... CF_API_TOKEN=... WORKER_DOMAIN=... node configure_login_screen.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  const workerUrl = process.env.WORKER_DOMAIN 
    ? (process.env.WORKER_DOMAIN.startsWith('http') ? process.env.WORKER_DOMAIN : `https://${process.env.WORKER_DOMAIN}`)
    : 'https://yellow-rose-access-bot.workers.dev';

  if (!accountId || !token) {
    console.error('Error: CF_ACCOUNT_ID and CF_API_TOKEN environment variables are required.');
    console.error('Example:');
    console.error('  CF_ACCOUNT_ID="abc" CF_API_TOKEN="xyz" node configure_login_screen.js');
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  console.log('🚀 Configuring Cloudflare Zero Trust Authentication Screen...');
  console.log(`• Cloudflare Account: ${accountId}`);
  console.log(`• Access Portal URL:  ${workerUrl}/request-access\n`);

  // Step 1: Update Access Organization Login Design (Header & Footer Text)
  console.log('1️⃣ Updating Access Organization Login Design (Header & Footer)...');
  try {
    const orgUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/organizations`;
    const orgRes = await fetch(orgUrl, { headers });
    const orgData = await orgRes.json();

    if (orgData.success && orgData.result) {
      const currentOrg = orgData.result;
      const updatePayload = {
        name: currentOrg.name || 'Yellow Rose BBQ',
        auth_domain: currentOrg.auth_domain,
        login_design: {
          background_color: '#0b0f19',
          text_color: '#f8fafc',
          header_text: 'Yellow Rose BBQ - Sausage & Prep Command',
          footer_text: `Need dashboard access? Request Access: ${workerUrl}/request-access`
        }
      };

      const putRes = await fetch(orgUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updatePayload)
      });
      const putData = await putRes.json();
      if (putData.success) {
        console.log('   ✅ Successfully updated Access Login Design with Request Access prompt!');
      } else {
        console.warn('   ⚠️ Could not update login design:', putData.errors?.[0]?.message || 'Unknown error');
      }
    } else {
      console.warn('   ⚠️ Could not fetch organization:', orgData.errors?.[0]?.message || 'Unknown error');
    }
  } catch (err) {
    console.warn('   ⚠️ Step 1 skipped/failed:', err.message);
  }

  // Step 2: Register / Update Custom Pages
  console.log('\n2️⃣ Registering Custom Auth & Block Pages in Cloudflare Access...');
  const templatesDir = path.resolve(__dirname, '../templates');
  const loginPath = path.join(templatesDir, 'login.html');
  const forbiddenPath = path.join(templatesDir, 'forbidden.html');

  if (fs.existsSync(loginPath)) {
    try {
      let loginHtml = fs.readFileSync(loginPath, 'utf8');
      loginHtml = loginHtml.replace('window.ACCESS_AGENT_URL || \'/api/request-access\'', `'${workerUrl}/api/request-access'`);

      const customPagesUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/custom_pages`;
      const pagesRes = await fetch(customPagesUrl, { headers });
      const pagesData = await pagesRes.json();
      const existing = (pagesData.result || []).find(p => p.type === 'login' || (p.name || '').includes('Yellow Rose'));

      if (existing) {
        const updateRes = await fetch(`${customPagesUrl}/${existing.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            name: 'Yellow Rose Auth & Request Access',
            type: 'login',
            custom_html: loginHtml
          })
        });
        const updateData = await updateRes.json();
        if (updateData.success) {
          console.log('   ✅ Updated existing custom login page with Request Access button!');
        }
      } else {
        const createRes = await fetch(customPagesUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: 'Yellow Rose Auth & Request Access',
            type: 'login',
            custom_html: loginHtml
          })
        });
        const createData = await createRes.json();
        if (createData.success) {
          console.log('   ✅ Created new custom login page with Request Access button!');
        }
      }
    } catch (err) {
      console.warn('   ⚠️ Custom login page registration note:', err.message);
    }
  }

  // Step 3: Configure Application Custom Deny URL
  console.log('\n3️⃣ Setting Application Deny Redirect (sausage.allen.tools)...');
  try {
    const appsUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/apps`;
    const appsRes = await fetch(appsUrl, { headers });
    const appsData = await appsRes.json();

    if (appsData.success && appsData.result) {
      const targetApp = appsData.result.find(a => 
        (a.domain || '').includes('sausage.allen.tools') || (a.domain || '').includes('sausage')
      );

      if (targetApp) {
        const updateAppUrl = `${appsUrl}/${targetApp.id}`;
        const appPayload = {
          ...targetApp,
          custom_deny_url: `${workerUrl}/request-access`,
          custom_deny_message: 'Staff access requires pitmaster authorization. Click below to request whitelist access.'
        };
        const updateAppRes = await fetch(updateAppUrl, {
          method: 'PUT',
          headers,
          body: JSON.stringify(appPayload)
        });
        const updateAppData = await updateAppRes.json();
        if (updateAppData.success) {
          console.log(`   ✅ Attached Request Access portal as custom deny URL for ${targetApp.domain}!`);
        }
      } else {
        console.log('   ℹ️ Application sausage.allen.tools not found in account apps list.');
      }
    }
  } catch (err) {
    console.warn('   ⚠️ Step 3 skipped/failed:', err.message);
  }

  console.log('\n✨ Configuration complete! When staff visit sausage.allen.tools, the Request Access button');
  console.log('   and approval prompt will appear directly on the authentication screen.\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
