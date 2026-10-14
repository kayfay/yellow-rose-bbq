# Yellow Rose BBQ - Natural Language Access Agent

A serverless Cloudflare Worker AI Telegram bot that manages Cloudflare Zero Trust Access policies for `sausage.allen.tools` using plain natural English.

---

## Capabilities

Talk to the agent naturally on your phone via Telegram:
- *"Add pitmaster.dave@gmail.com to the allowed list"*
- *"Can you authorize sarah.bbq@yahoo.com to see the dashboard?"*
- *"Who can view the site right now?"*
- *"Remove mike@gmail.com"*
- *"Status"*

The agent parses your intent using **Cloudflare Workers AI (Llama 3.1)** and updates your Cloudflare Zero Trust Access Policy in real-time.

---

## 1. Setup Cloudflare Zero Trust for `sausage.allen.tools`

1. Open the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
2. Go to **Access** > **Applications** > **Add an application** > **Self-hosted**.
3. Set:
   - **Application Name**: `Yellow Rose POS Analytics`
   - **Application domain**: `sausage.allen.tools`
   - **Session Duration**: e.g., `30 days` (so kitchen staff aren't logged out daily).
4. Under **Policies**, create a policy:
   - **Policy Name**: `Staff Email Whitelist`
   - **Action**: `Allow`
   - **Configure rules** > **Include**: Add **Selector: Emails** (you can put your own email initially).
5. Note down:
   - Your **Cloudflare Account ID** (found in Cloudflare dashboard URL or Workers tab).
   - The **Application ID** and **Policy ID** (from the URL or API).

---

## 2. Create Your Telegram Bot

1. Open Telegram and message `@BotFather`.
2. Send `/newbot`, name it (e.g., `YellowRoseAccessBot`), and choose a username.
3. Save the **Bot Token** (format: `123456789:ABCdef...`).
4. Message `@userinfobot` on Telegram to get your numeric **Telegram User ID** (e.g. `123456789`).

---

## 3. Configure Worker Secrets

In the `access_agent/` directory:

```bash
cd access_agent
npx wrangler secret put TELEGRAM_BOT_TOKEN
# Paste your Bot Token

npx wrangler secret put TELEGRAM_ADMIN_IDS
# Paste your numeric Telegram ID (or comma-separated IDs)

npx wrangler secret put CF_ACCOUNT_ID
# Paste your Cloudflare Account ID

npx wrangler secret put CF_ACCESS_APP_ID
# Paste your Cloudflare Access Application ID

npx wrangler secret put CF_ACCESS_POLICY_ID
# Paste your Cloudflare Access Policy ID

npx wrangler secret put CF_API_TOKEN
# Cloudflare API Token with "Zero Trust: Edit" permission
```

---

## 4. Deploy the Worker

```bash
npx wrangler deploy
```

Once deployed, Wrangler will output your worker URL (e.g., `https://yellow-rose-access-bot.<subdomain>.workers.dev`).

---

## 5. Register the Telegram Webhook

Point Telegram to your newly deployed Worker:

```bash
curl -F "url=https://yellow-rose-access-bot.<subdomain>.workers.dev" \
  "https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook"
```

Telegram will respond with:
```json
{"ok": true, "result": true, "description": "Webhook was set"}
```

---

## 6. Verification

1. Open your Telegram bot.
2. Send: `/start`
3. Try natural commands:
   - *"Add mytest@gmail.com to the site"*
   - *"Who has access?"*
   - *"Remove mytest@gmail.com"*
