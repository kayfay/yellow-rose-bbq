/**
 * Yellow Rose BBQ - Natural Language Access Agent & Instant Approval Bot
 * Cloudflare Worker that:
 * 1. Hosts a Web "Request Access" form & REST API for sausage.allen.tools.
 * 2. Sends instant push alerts to Telegram with interactive [Approve] / [Deny] inline buttons.
 * 3. Handles Telegram inline callback clicks to automatically whitelist emails in Cloudflare Zero Trust.
 * 4. Processes natural language commands from authorized Telegram admins.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // 2. Web UI: "Request Access" HTML Form
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/request-access")) {
      return serveRequestAccessHtml();
    }

    // 3. API Endpoint: Submit Access Request
    if (request.method === "POST" && (url.pathname === "/api/request-access" || url.pathname === "/request-access")) {
      return handleWebRequestAccess(request, env);
    }

    // 4. Telegram Webhook (POST to root or any path not handled above)
    if (request.method === "POST") {
      return handleTelegramWebhook(request, env);
    }

    return new Response("Yellow Rose Access Agent is online.", { status: 200 });
  },
};

/**
 * Handles incoming web requests from staff requesting access.
 * Sends interactive Telegram alert with [Approve] and [Deny] inline buttons.
 */
export async function handleWebRequestAccess(request, env) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    let email = "";
    let name = "";
    let note = "";

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      email = (body.email || "").trim().toLowerCase();
      name = (body.name || "").trim();
      note = (body.note || "").trim();
    } else {
      const formData = await request.formData();
      email = (formData.get("email") || "").trim().toLowerCase();
      name = (formData.get("name") || "").trim();
      note = (formData.get("note") || "").trim();
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: "Please enter a valid email address." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Pre-check if email is already in the approved policy list
    try {
      if (env.CF_API_TOKEN && env.CF_ACCOUNT_ID) {
        const { policy } = await resolvePolicy(env);
        const existing = extractEmailsFromPolicy(policy);
        if (existing.includes(email)) {
          return new Response(
            JSON.stringify({
              success: true,
              alreadyApproved: true,
              message: `Your email (${email}) already has active access! You can log in directly at sausage.allen.tools.`,
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }
    } catch (e) {
      console.warn("Could not pre-check policy whitelist:", e.message);
    }

    // Send interactive Telegram push alert to authorized admins
    const adminIds = (env.TELEGRAM_ADMIN_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const timeStr = new Date().toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
    });

    const alertText =
      `🔔 *Access Request: sausage.allen.tools*\n\n` +
      `• *Email:* \`${email}\`\n` +
      (name ? `• *Requester:* ${name}\n` : "") +
      (note ? `• *Note:* _${note}_\n` : "") +
      `• *Time:* ${timeStr} EST\n\n` +
      `Tap below to instantly grant or deny access:`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: `✅ Approve Access`, callback_data: `approve:${email}` },
          { text: `❌ Deny`, callback_data: `deny:${email}` },
        ],
      ],
    };

    if (env.TELEGRAM_BOT_TOKEN && adminIds.length > 0) {
      for (const adminId of adminIds) {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, adminId, alertText, inlineKeyboard);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        email: email,
        message: `Request received for ${email}! An instant confirmation alert has been sent to the pitmaster on Telegram.`,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    console.error("Error in handleWebRequestAccess:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
}

/**
 * Handles incoming Telegram updates (messages & button callback clicks).
 */
export async function handleTelegramWebhook(request, env) {
  try {
    const update = await request.json();
    console.log("Received update:", JSON.stringify(update));

    const allowedAdminIds = (env.TELEGRAM_ADMIN_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    // 1. Handle Inline Button Callback Queries (One-Click Confirmation)
    if (update.callback_query) {
      const cb = update.callback_query;
      const userId = String(cb.from?.id || "");

      if (!allowedAdminIds.includes(userId)) {
        console.warn(`Unauthorized callback query attempt from userId "${userId}"`);
        if (env.TELEGRAM_BOT_TOKEN) {
          await answerTelegramCallback(env.TELEGRAM_BOT_TOKEN, cb.id, "Unauthorized.");
        }
        return new Response("OK", { status: 200 });
      }

      const data = cb.data || "";
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;
      const adminName = cb.from?.username ? `@${cb.from.username}` : (cb.from?.first_name || "Admin");

      if (data.startsWith("approve:")) {
        const targetEmail = data.replace("approve:", "").trim().toLowerCase();
        const reply = await handleAddUser(env, targetEmail);
        if (env.TELEGRAM_BOT_TOKEN) {
          await answerTelegramCallback(env.TELEGRAM_BOT_TOKEN, cb.id, `✅ Access granted to ${targetEmail}`);
          if (chatId && messageId) {
            await editTelegramMessage(
              env.TELEGRAM_BOT_TOKEN,
              chatId,
              messageId,
              `✅ *Access Approved*\n\nUser \`${targetEmail}\` has been whitelisted on *sausage.allen.tools* by ${adminName}.\n\n_${reply}_`
            );
          }
        }
        return new Response("OK", { status: 200 });
      }

      if (data.startsWith("deny:")) {
        const targetEmail = data.replace("deny:", "").trim().toLowerCase();
        if (env.TELEGRAM_BOT_TOKEN) {
          await answerTelegramCallback(env.TELEGRAM_BOT_TOKEN, cb.id, `❌ Request dismissed for ${targetEmail}`);
          if (chatId && messageId) {
            await editTelegramMessage(
              env.TELEGRAM_BOT_TOKEN,
              chatId,
              messageId,
              `❌ *Access Denied*\n\nAccess request for \`${targetEmail}\` was dismissed by ${adminName}.`
            );
          }
        }
        return new Response("OK", { status: 200 });
      }

      return new Response("OK", { status: 200 });
    }

    // 2. Handle Text Messages
    if (!update.message || !update.message.text) {
      return new Response("OK", { status: 200 });
    }

    const message = update.message;
    const chatId = message.chat.id;
    const userId = String(message.from?.id || "");
    const userText = message.text.trim();

    if (!allowedAdminIds.includes(userId)) {
      console.warn(`Unauthorized text message attempt: userId "${userId}"`);
      return new Response("OK", { status: 200 });
    }

    // Handle standard /start or /help
    if (userText === "/start" || userText === "/help") {
      await sendTelegramMessage(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        "👋 *Yellow Rose Access Agent*\n\n" +
        "I manage who can view *sausage.allen.tools*.\n\n" +
        "You will receive push requests with *[Approve]* buttons whenever staff request access.\n\n" +
        "You can also manage access directly by typing:\n" +
        "• _\"Add yellowrosebbqjax@gmail.com to the whitelist\"_\n" +
        "• _\"Remove olduser@gmail.com\"_\n" +
        "• _\"Who has access right now?\"_\n" +
        "• _\"Configure login screen\"_ (sets Request Access prompt on Cloudflare email auth page)\n" +
        "• _\"Status\"_"
      );
      return new Response("OK", { status: 200 });
    }

    if (userText.toLowerCase() === "debug" || userText.toLowerCase() === "/debug") {
      const debugInfo = await handleDebug(env);
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, debugInfo);
      return new Response("OK", { status: 200 });
    }

    if (
      userText.toLowerCase() === "setup login" ||
      userText.toLowerCase() === "/setup_login" ||
      userText.toLowerCase() === "configure login" ||
      userText.toLowerCase() === "/configure_login" ||
      userText.toLowerCase() === "configure login screen"
    ) {
      const setupResult = await configureAccessLoginPage(env);
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, setupResult);
      return new Response("OK", { status: 200 });
    }

    // Natural Language Intent Parsing with Workers AI
    const parsed = await parseIntentWithAI(env.AI, userText);
    console.log("Parsed intent result:", JSON.stringify(parsed));

    const allEmails = extractAllEmails(userText);
    if (allEmails.length > 1 && parsed.action === "add_user") {
      let results = [];
      for (const em of allEmails) {
        results.push(await handleAddUser(env, em));
      }
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, results.join("\n\n"));
      return new Response("OK", { status: 200 });
    }

    // Execute Action
    let replyText = "";
    switch (parsed.action) {
      case "add_user": {
        const targetEmail = parsed.email || (allEmails.length ? allEmails[0] : null);
        if (!targetEmail) {
          replyText = "⚠️ What email address should I grant access to?";
        } else {
          replyText = await handleAddUser(env, targetEmail);
        }
        break;
      }

      case "remove_user": {
        const targetEmail = parsed.email || (allEmails.length ? allEmails[0] : null);
        if (!targetEmail) {
          replyText = "⚠️ Which email address should I revoke access for?";
        } else {
          replyText = await handleRemoveUser(env, targetEmail);
        }
        break;
      }

      case "list_users": {
        replyText = await handleListUsers(env);
        break;
      }

      case "status": {
        replyText = await handleStatus(env);
        break;
      }

      case "configure_login": {
        replyText = await configureAccessLoginPage(env);
        break;
      }

      default: {
        replyText =
          parsed.explanation ||
          "🤔 I wasn't completely sure. You can ask me to *add* an email, *remove* an email, or *list* who currently has access.";
        break;
      }
    }

    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, replyText);
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Error processing update:", err);
    return new Response("Error: " + err.message, { status: 500 });
  }
}

/**
 * Serves a mobile-friendly, clean Dark Kitchen UI for staff to request access.
 */
export function serveRequestAccessHtml() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yellow Rose BBQ - Request Dashboard Access</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #151c2c;
      --border: #2d3748;
      --accent: #f59e0b;
      --accent-hover: #d97706;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --success-bg: rgba(16, 185, 129, 0.15);
      --success-border: #10b981;
      --error-bg: rgba(239, 68, 68, 0.15);
      --error-border: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
    }
    .card {
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      max-width: 440px;
      width: 100%;
      padding: 28px 24px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .logo { font-size: 28px; }
    h1 { font-size: 20px; font-weight: 700; color: #fff; }
    p.desc {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    input {
      width: 100%;
      background: #0b0f19;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 14px;
      font-size: 15px;
      color: #fff;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus { border-color: var(--accent); }
    button {
      width: 100%;
      background: var(--accent);
      color: #000;
      border: none;
      border-radius: 8px;
      padding: 14px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      min-height: 48px;
      transition: background 0.2s, opacity 0.2s;
      margin-top: 8px;
    }
    button:hover { background: var(--accent-hover); }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .status-msg {
      margin-top: 16px;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.4;
      display: none;
    }
    .status-msg.success {
      display: block;
      background: var(--success-bg);
      border: 1px solid var(--success-border);
      color: #34d399;
    }
    .status-msg.error {
      display: block;
      background: var(--error-bg);
      border: 1px solid var(--error-border);
      color: #f87171;
    }
    .footer-link {
      display: block;
      text-align: center;
      margin-top: 20px;
      font-size: 13px;
      color: var(--text-muted);
      text-decoration: none;
    }
    .footer-link:hover { color: #fff; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="logo">🔥</span>
      <div>
        <h1>Request Access</h1>
        <div style="font-size: 12px; color: var(--accent); font-weight: 600;">Yellow Rose BBQ Analytics</div>
      </div>
    </div>
    <p class="desc">
      Enter your staff email address below. The pitmaster will receive an instant approval request on Telegram to whitelist your account.
    </p>
    <form id="access-form">
      <div class="form-group">
        <label for="email">Staff Email Address</label>
        <input type="email" id="email" name="email" required placeholder="chef@yellowrosebbq.com" autofocus autocomplete="email" />
      </div>
      <div class="form-group">
        <label for="name">Your Name / Role (Optional)</label>
        <input type="text" id="name" name="name" placeholder="e.g. Dave (Morning Smoke Watch)" />
      </div>
      <button type="submit" id="submit-btn">Send Access Request</button>
      <div id="status" class="status-msg"></div>
    </form>
    <a href="https://sausage.allen.tools" class="footer-link">&larr; Return to Dashboard Login</a>
  </div>

  <script>
    const form = document.getElementById('access-form');
    const submitBtn = document.getElementById('submit-btn');
    const statusDiv = document.getElementById('status');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const name = document.getElementById('name').value.trim();

      if (!email) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending Request...';
      statusDiv.className = 'status-msg';
      statusDiv.style.display = 'none';

      try {
        const res = await fetch('/api/request-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          statusDiv.className = 'status-msg success';
          statusDiv.innerHTML = '<strong>Request Sent!</strong><br>' + data.message;
          form.reset();
        } else {
          statusDiv.className = 'status-msg error';
          statusDiv.innerHTML = '<strong>Error:</strong> ' + (data.error || 'Unable to submit request.');
        }
      } catch (err) {
        statusDiv.className = 'status-msg error';
        statusDiv.innerHTML = '<strong>Network Error:</strong> Unable to connect to Access Agent.';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Access Request';
      }
    });
  </script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function extractAllEmails(text) {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  return [...new Set(matches.map((e) => e.toLowerCase()))];
}

export async function parseIntentWithAI(ai, userText) {
  const emails = extractAllEmails(userText);
  const foundEmail = emails.length ? emails[0] : null;

  const systemPrompt = `You are an intent parser for access management.
Return ONLY valid JSON in format:
{"action": "add_user"|"remove_user"|"list_users"|"status"|"configure_login"|"unknown", "email": "email_or_null", "explanation": "string"}
Actions:
- add_user: Add, whitelist, permit, or grant an email.
- remove_user: Remove, revoke, delete, or kick an email.
- list_users: Who has access, list users, show whitelist.
- status: Health check, status.
- configure_login: Configure, setup, or link Request Access on the login/auth screen.`;

  try {
    const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
      temperature: 0.1,
      max_tokens: 150,
    });

    const raw = (response.response || response.text || "").trim();
    const cleanJson = raw.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
    const result = JSON.parse(cleanJson);
    if (!result.email && foundEmail) {
      result.email = foundEmail;
    }
    return result;
  } catch (e) {
    const lower = userText.toLowerCase();
    if (lower.includes("list") || lower.includes("who") || lower.includes("whitelist")) {
      return { action: "list_users", email: null };
    }
    if (lower.includes("login") || lower.includes("auth screen") || lower.includes("setup login") || lower.includes("configure login")) {
      return { action: "configure_login", email: null };
    }
    if ((lower.includes("add") || lower.includes("whitelist") || lower.includes("allow") || lower.includes("approve")) && foundEmail) {
      return { action: "add_user", email: foundEmail };
    }
    if ((lower.includes("remove") || lower.includes("revoke") || lower.includes("deny")) && foundEmail) {
      return { action: "remove_user", email: foundEmail };
    }
    return {
      action: "unknown",
      email: foundEmail,
      explanation: "I couldn't parse the command. Would you like to add or remove an email, or view current users?",
    };
  }
}

async function handleDebug(env) {
  try {
    const accountId = env.CF_ACCOUNT_ID;
    const token = env.CF_API_TOKEN;
    const headers = { Authorization: `Bearer ${token}` };

    let report = `🔍 *Diagnostics Report*\n\n`;

    // 1. Account Policies (reusable)
    const acctPolUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/policies`;
    const acctPolRes = await fetch(acctPolUrl, { headers });
    const acctPolData = await acctPolRes.json();
    report += `• Account Policies: ${acctPolData.result?.length || 0}\n`;
    if (acctPolData.result && acctPolData.result.length > 0) {
      for (const p of acctPolData.result) {
        report += `  - ${p.name} (ID: \`${p.id}\`)\n`;
      }
    }

    // 2. Account Apps
    const acctAppsUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/apps`;
    const acctAppsRes = await fetch(acctAppsUrl, { headers });
    const acctAppsData = await acctAppsRes.json();
    report += `\n• Account Apps: ${acctAppsData.result?.length || 0}\n`;
    if (acctAppsData.result && acctAppsData.result.length > 0) {
      for (const a of acctAppsData.result) {
        report += `  - ${a.name} (${a.domain}) (ID: \`${a.id}\`)\n`;
      }
    }

    return report;
  } catch (err) {
    return `Debug error: ${err.message}`;
  }
}

/**
 * Universal policy resolver: handles Account-level reusable policies
 * as well as App-specific policies.
 */
async function resolvePolicy(env) {
  const accountId = env.CF_ACCOUNT_ID;
  const token = env.CF_API_TOKEN;
  const headers = { Authorization: `Bearer ${token}` };

  // 1. First, check Account-level policies
  const acctPolUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/policies`;
  const acctPolRes = await fetch(acctPolUrl, { headers });
  const acctPolData = await acctPolRes.json();

  if (acctPolData.success && acctPolData.result && acctPolData.result.length > 0) {
    const found =
      acctPolData.result.find(
        (p) =>
          (p.name || "").toLowerCase().includes("whitelist") ||
          (p.name || "").toLowerCase().includes("staff")
      ) || acctPolData.result[0];
    return { type: "account_policy", policy: found, accountId };
  }

  // 2. If no account policy, check Apps and their policies
  const acctAppsUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/apps`;
  const acctAppsRes = await fetch(acctAppsUrl, { headers });
  const acctAppsData = await acctAppsRes.json();

  if (acctAppsData.success && acctAppsData.result && acctAppsData.result.length > 0) {
    const targetApp =
      acctAppsData.result.find(
        (a) =>
          (a.domain || "").includes("sausage") || (a.domain || "").includes("allen.tools")
      ) || acctAppsData.result[0];
    const appPolUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/apps/${targetApp.id}/policies`;
    const appPolRes = await fetch(appPolUrl, { headers });
    const appPolData = await appPolRes.json();
    if (appPolData.success && appPolData.result && appPolData.result.length > 0) {
      return { type: "app_policy", appId: targetApp.id, policy: appPolData.result[0], accountId };
    }
  }

  throw new Error("No Access policies found in this Cloudflare account.");
}

export async function handleAddUser(env, email) {
  try {
    const resolved = await resolvePolicy(env);
    const policy = resolved.policy;
    const existingEmails = extractEmailsFromPolicy(policy);

    if (existingEmails.includes(email.toLowerCase())) {
      return `ℹ️ *${email}* is already in the approved list.`;
    }

    const updatedInclude = [...(policy.include || []), { email: { email: email.toLowerCase() } }];
    const updatedPolicy = {
      ...policy,
      include: updatedInclude,
    };

    await updatePolicy(env, resolved, updatedPolicy);
    return `✅ Added! Access granted to *${email}*.`;
  } catch (err) {
    return `❌ Failed to add *${email}*: ${cleanError(err.message)}`;
  }
}

export async function handleRemoveUser(env, email) {
  try {
    const resolved = await resolvePolicy(env);
    const policy = resolved.policy;
    const target = email.toLowerCase();
    const initialCount = (policy.include || []).length;

    const updatedInclude = (policy.include || []).filter((rule) => {
      if (rule.email && rule.email.email && rule.email.email.toLowerCase() === target) {
        return false;
      }
      return true;
    });

    if (updatedInclude.length === initialCount) {
      return `ℹ️ *${email}* was not found in the approved list.`;
    }

    const updatedPolicy = {
      ...policy,
      include: updatedInclude,
    };

    await updatePolicy(env, resolved, updatedPolicy);
    return `🚫 Revoked! Access removed for *${email}*.`;
  } catch (err) {
    return `❌ Failed to remove *${email}*: ${cleanError(err.message)}`;
  }
}

export async function handleListUsers(env) {
  try {
    const { policy } = await resolvePolicy(env);
    const emails = extractEmailsFromPolicy(policy);

    if (emails.length === 0) {
      return `📋 *Approved Users:*\nNo individual emails configured in this policy yet.`;
    }

    const listFormatted = emails.map((e, idx) => `${idx + 1}. \`${e}\``).join("\n");
    return `📋 *Currently Approved Users (${emails.length}):*\n\n${listFormatted}`;
  } catch (err) {
    return `❌ Failed to fetch user list: ${cleanError(err.message)}`;
  }
}

export async function handleStatus(env) {
  try {
    const { policy, type } = await resolvePolicy(env);
    const emails = extractEmailsFromPolicy(policy);
    return (
      `🟢 *Access Gateway Healthy*\n\n` +
      `• *Policy:* ${policy.name || "Default"}\n` +
      `• *Whitelisted Users:* ${emails.length}\n` +
      `• *Policy Type:* ${type}\n` +
      `• *Policy ID:* \`${policy.id}\``
    );
  } catch (err) {
    return `⚠️ Access Gateway Error: ${cleanError(err.message)}`;
  }
}

export function extractEmailsFromPolicy(policy) {
  if (!policy || !policy.include || !Array.isArray(policy.include)) return [];
  const emails = [];
  for (const item of policy.include) {
    if (item.email && item.email.email) {
      emails.push(item.email.email.toLowerCase());
    }
  }
  return emails;
}

async function updatePolicy(env, resolved, policyPayload) {
  const { type, appId, accountId } = resolved;
  const policyId = policyPayload.id;

  const url =
    type === "account_policy"
      ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/policies/${policyId}`
      : `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/apps/${appId}/policies/${policyId}`;

  const body = {
    name: policyPayload.name,
    decision: policyPayload.decision || "allow",
    include: policyPayload.include || [],
    exclude: policyPayload.exclude || [],
    require: policyPayload.require || [],
  };

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    const msg = data.errors?.map((e) => e.message).join(", ") || res.statusText;
    throw new Error(`Cloudflare API error (${res.status}): ${msg}`);
  }
  return data.result;
}

function cleanError(str) {
  return (str || "").replace(/[_*`]/g, " ");
}

export async function sendTelegramMessage(botToken, chatId, text, replyMarkup = null) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: "Markdown",
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    body.text = text.replace(/[*_`]/g, "");
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
}

export async function answerTelegramCallback(botToken, callbackQueryId, text = "") {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: false,
    }),
  });
}

export async function editTelegramMessage(botToken, chatId, messageId, text, replyMarkup = null) {
  const url = `https://api.telegram.org/bot${botToken}/editMessageText`;
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: "Markdown",
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    body.text = text.replace(/[*_`]/g, "");
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
}

/**
 * Automatically configures Cloudflare Zero Trust Access so the Request Access
 * button presents itself directly on the login screen where email authentication is asked.
 */
export async function configureAccessLoginPage(env, customWorkerUrl = null) {
  try {
    const accountId = env.CF_ACCOUNT_ID;
    const token = env.CF_API_TOKEN;
    if (!accountId || !token) {
      return "⚠️ Cloudflare credentials (CF_ACCOUNT_ID and CF_API_TOKEN) are missing.";
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const workerUrl =
      customWorkerUrl ||
      (env.WORKER_DOMAIN
        ? env.WORKER_DOMAIN.startsWith("http")
          ? env.WORKER_DOMAIN
          : `https://${env.WORKER_DOMAIN}`
        : "https://yellow-rose-access-bot.workers.dev");

    let summary = `🔐 *Zero Trust Authentication Screen Setup*\n\n`;

    // 1. Update Access Organization login_design
    const orgUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/organizations`;
    const orgRes = await fetch(orgUrl, { headers });
    const orgData = await orgRes.json();

    if (orgData.success && orgData.result) {
      const org = orgData.result;
      const updatePayload = {
        name: org.name || "Yellow Rose BBQ",
        auth_domain: org.auth_domain,
        login_design: {
          background_color: "#0b0f19",
          text_color: "#f8fafc",
          header_text: "Yellow Rose BBQ - Sausage & Prep Command",
          footer_text: `Need dashboard access? Request Access: ${workerUrl}/request-access`,
        },
      };

      const putRes = await fetch(orgUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify(updatePayload),
      });
      const putData = await putRes.json();
      if (putData.success) {
        summary += `✅ *Login Screen Prompt Attached:*\nFooter updated with Request Access prompt on the email authentication screen.\n\n`;
      } else {
        summary += `⚠️ Login Design Notice: ${putData.errors?.[0]?.message || "Could not update footer"}\n\n`;
      }
    }

    // 2. Update Application Deny URL
    const appsUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/apps`;
    const appsRes = await fetch(appsUrl, { headers });
    const appsData = await appsRes.json();

    if (appsData.success && appsData.result) {
      const targetApp = appsData.result.find(
        (a) => (a.domain || "").includes("sausage") || (a.domain || "").includes("allen.tools")
      );
      if (targetApp) {
        const updateAppUrl = `${appsUrl}/${targetApp.id}`;
        const appPayload = {
          ...targetApp,
          custom_deny_url: `${workerUrl}/request-access`,
          custom_deny_message:
            "Staff access requires pitmaster authorization. Use the Request Access portal to get approved.",
        };
        const appRes = await fetch(updateAppUrl, {
          method: "PUT",
          headers,
          body: JSON.stringify(appPayload),
        });
        const appData = await appRes.json();
        if (appData.success) {
          summary += `✅ *Application Deny Redirect Configured:*\nBlocked visitors on ${targetApp.domain} are routed directly to the Request Access portal.\n\n`;
        }
      }
    }

    summary += `👉 *Staff will now see the Request Access button right where email is asked for authentication!*`;
    return summary;
  } catch (err) {
    return `❌ Configuration failed: ${cleanError(err.message)}`;
  }
}

