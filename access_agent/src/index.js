/**
 * Yellow Rose BBQ - Natural Language Access Agent
 * Cloudflare Worker that processes natural language requests from Telegram,
 * parses intent using Cloudflare Workers AI, and manages Cloudflare Zero Trust
 * Access policies for sausage.allen.tools.
 */

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Yellow Rose Access Agent is online.", { status: 200 });
    }

    try {
      const update = await request.json();
      console.log("Received update:", JSON.stringify(update));

      if (!update.message || !update.message.text) {
        return new Response("OK", { status: 200 });
      }

      const message = update.message;
      const chatId = message.chat.id;
      const userId = String(message.from?.id || "");
      const userText = message.text.trim();

      // 1. Identity Verification
      const allowedAdminIds = (env.TELEGRAM_ADMIN_IDS || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      if (!allowedAdminIds.includes(userId)) {
        console.warn(`Unauthorized attempt: userId "${userId}"`);
        return new Response("OK", { status: 200 });
      }

      // Handle standard /start or /help
      if (userText === "/start" || userText === "/help") {
        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          "👋 *Yellow Rose Access Agent*\n\n" +
          "I manage who can view *sausage.allen.tools*.\n\n" +
          "You can talk to me naturally:\n" +
          "• _\"Add yellowrosebbqjax@gmail.com to the whitelist\"_\n" +
          "• _\"Remove olduser@gmail.com\"_\n" +
          "• _\"Who has access right now?\"_\n" +
          "• _\"Status\"_"
        );
        return new Response("OK", { status: 200 });
      }

      if (userText.toLowerCase() === "debug" || userText.toLowerCase() === "/debug") {
        const debugInfo = await handleDebug(env);
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, debugInfo);
        return new Response("OK", { status: 200 });
      }

      // 2. Natural Language Intent Parsing with Workers AI
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

      // 3. Execute Action
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

        default: {
          replyText = parsed.explanation || 
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
  },
};

function extractAllEmails(text) {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  return [...new Set(matches.map((e) => e.toLowerCase()))];
}

export async function parseIntentWithAI(ai, userText) {
  const emails = extractAllEmails(userText);
  const foundEmail = emails.length ? emails[0] : null;

  const systemPrompt = `You are an intent parser for access management.
Return ONLY valid JSON in format:
{"action": "add_user"|"remove_user"|"list_users"|"status"|"unknown", "email": "email_or_null", "explanation": "string"}
Actions:
- add_user: Add, whitelist, permit, or grant an email.
- remove_user: Remove, revoke, delete, or kick an email.
- list_users: Who has access, list users, show whitelist.
- status: Health check, status.`;

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
    if ((lower.includes("add") || lower.includes("whitelist") || lower.includes("allow")) && foundEmail) {
      return { action: "add_user", email: foundEmail };
    }
    if ((lower.includes("remove") || lower.includes("revoke")) && foundEmail) {
      return { action: "remove_user", email: foundEmail };
    }
    return { action: "unknown", email: foundEmail, explanation: "I couldn't parse the command. Would you like to add or remove an email, or view current users?" };
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
    // Look for Staff Whitelist or matching policy name
    const found = acctPolData.result.find(p => (p.name || "").toLowerCase().includes("whitelist") || (p.name || "").toLowerCase().includes("staff")) || acctPolData.result[0];
    return { type: "account_policy", policy: found, accountId };
  }

  // 2. If no account policy, check Apps and their policies
  const acctAppsUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/apps`;
  const acctAppsRes = await fetch(acctAppsUrl, { headers });
  const acctAppsData = await acctAppsRes.json();

  if (acctAppsData.success && acctAppsData.result && acctAppsData.result.length > 0) {
    const targetApp = acctAppsData.result.find(a => (a.domain || "").includes("sausage") || (a.domain || "").includes("allen.tools")) || acctAppsData.result[0];
    const appPolUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/apps/${targetApp.id}/policies`;
    const appPolRes = await fetch(appPolUrl, { headers });
    const appPolData = await appPolRes.json();
    if (appPolData.success && appPolData.result && appPolData.result.length > 0) {
      return { type: "app_policy", appId: targetApp.id, policy: appPolData.result[0], accountId };
    }
  }

  throw new Error("No Access policies found in this Cloudflare account.");
}

async function handleAddUser(env, email) {
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

async function handleRemoveUser(env, email) {
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

async function handleListUsers(env) {
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

async function handleStatus(env) {
  try {
    const { policy, type } = await resolvePolicy(env);
    const emails = extractEmailsFromPolicy(policy);
    return `🟢 *Access Gateway Healthy*\n\n` +
      `• *Policy:* ${policy.name || "Default"}\n` +
      `• *Whitelisted Users:* ${emails.length}\n` +
      `• *Policy Type:* ${type}\n` +
      `• *Policy ID:* \`${policy.id}\``;
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

  // Modern Cloudflare Zero Trust: Account-level endpoint supports reusable policies
  const url = type === "account_policy"
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

async function sendTelegramMessage(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown",
    }),
  });

  if (!res.ok) {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.replace(/[*_`]/g, ""),
      }),
    });
  }
}
