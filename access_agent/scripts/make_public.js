#!/usr/bin/env node
/**
 * make_public.js
 * 
 * Removes Cloudflare Zero Trust Access restrictions on sausage.allen.tools,
 * opening the page to anyone who has the link.
 * 
 * Usage:
 *   CF_ACCOUNT_ID=... CF_API_TOKEN=... node make_public.js [--delete-app]
 * 
 * Defaults to setting a 'Bypass' policy for Everyone (instant public access).
 * Pass --delete-app to completely delete the Access application from Zero Trust.
 */

async function main() {
  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  const shouldDeleteApp = process.argv.includes('--delete-app');

  if (!accountId || !token) {
    console.error('❌ Error: CF_ACCOUNT_ID and CF_API_TOKEN environment variables are required.');
    console.error('Example:');
    console.error('  CF_ACCOUNT_ID="your_account_id" CF_API_TOKEN="your_token" node make_public.js');
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  console.log('🔓 Opening sausage.allen.tools to the public...\n');

  // 1. Locate Access Applications
  const appsUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/apps`;
  const appsRes = await fetch(appsUrl, { headers });
  const appsData = await appsRes.json();

  if (!appsData.success || !appsData.result || appsData.result.length === 0) {
    console.log('ℹ️ No Access applications found in this account.');
    return;
  }

  const targetApp = appsData.result.find(
    (a) =>
      (a.domain || '').includes('sausage.allen.tools') ||
      (a.domain || '').includes('sausage') ||
      (a.domain || '').includes('allen.tools')
  );

  if (!targetApp) {
    console.log('ℹ️ No application matching "sausage.allen.tools" was found in Cloudflare Access.');
    console.log('Available applications:');
    appsData.result.forEach((a) => console.log(`  - ${a.name} (${a.domain}) [ID: ${a.id}]`));
    return;
  }

  console.log(`Found application: ${targetApp.name} (${targetApp.domain}) [ID: ${targetApp.id}]`);

  if (shouldDeleteApp) {
    // Delete application completely
    console.log(`\n🗑️ Deleting Access Application "${targetApp.name}"...`);
    const delRes = await fetch(`${appsUrl}/${targetApp.id}`, {
      method: 'DELETE',
      headers,
    });
    const delData = await delRes.json();
    if (delData.success) {
      console.log('✅ Access Application successfully deleted!');
      console.log('🎉 sausage.allen.tools is now completely open to anyone with the link.');
    } else {
      console.error('❌ Failed to delete application:', delData.errors?.[0]?.message || 'Unknown error');
    }
  } else {
    // Attach or update a Bypass policy for Everyone
    console.log('\n⚡ Setting Access Policy to "Bypass" for Everyone...');
    const polUrl = `${appsUrl}/${targetApp.id}/policies`;
    const polRes = await fetch(polUrl, { headers });
    const polData = await polRes.json();

    const existingPolicies = (polData.success && polData.result) || [];
    const bypassPolicy = existingPolicies.find((p) => p.name === 'Public Access (Bypass)');

    const policyPayload = {
      name: 'Public Access (Bypass)',
      decision: 'bypass',
      include: [{ everyone: {} }],
      exclude: [],
      require: [],
    };

    if (bypassPolicy) {
      // Update existing
      const updateRes = await fetch(`${polUrl}/${bypassPolicy.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(policyPayload),
      });
      const updateData = await updateRes.json();
      if (updateData.success) {
        console.log('✅ Updated existing policy to Bypass for Everyone.');
      } else {
        console.error('❌ Failed to update policy:', updateData.errors?.[0]?.message || 'Unknown error');
      }
    } else {
      // Create new bypass policy
      const createRes = await fetch(polUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(policyPayload),
      });
      const createData = await createRes.json();
      if (createData.success) {
        console.log('✅ Created new Bypass policy for Everyone.');
      } else {
        console.error('❌ Failed to create policy:', createData.errors?.[0]?.message || 'Unknown error');
      }
    }

    console.log('\n🎉 sausage.allen.tools is now publicly open! Anyone with the link can view it without logging in.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
