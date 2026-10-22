# Yellow Rose BBQ - Natural Language Access Agent & Instant Approval Bot

A serverless Cloudflare Worker AI Telegram bot that manages Cloudflare Zero Trust Access policies for `sausage.allen.tools` using plain natural English, web request access forms, and instant interactive Telegram notifications.

---

## Capabilities

1. **Instant Telegram Push & One-Click Approval**:
   - When a staff member or visitor requests access, the pitmaster receives an instant notification in Telegram with interactive buttons:
     ```
     🔔 Access Request: sausage.allen.tools

     • Email: cook.dan@gmail.com
     • Requester: Dan (Morning Smoke Watch)
     • Time: 6:30 PM EST

     [ ✅ Approve Access ]   [ ❌ Deny ]
     ```
   - Tapping **[ ✅ Approve Access ]** instantly calls the Cloudflare Zero Trust API, adds the user to the Access Policy whitelist, and confirms in Telegram!

2. **Web Request Access Portal & REST API**:
   - Hosts a mobile-friendly web form at `https://<worker-subdomain>.workers.dev/request-access`.
   - Provides a CORS-enabled REST API at `POST /api/request-access` that accepts `{ "email": "staff@example.com", "name": "Dave" }`.

3. **Natural English Commands on Telegram**:
   - *"Add pitmaster.dave@gmail.com to the allowed list"*
   - *"Can you authorize sarah.bbq@yahoo.com to see the dashboard?"*
   - *"Who can view the site right now?"*
   - *"Remove mike@gmail.com"*
   - *"Status"*

The agent parses intent using **Cloudflare Workers AI (Llama 3.1)** and updates Cloudflare Zero Trust Access Policies in real-time.

---

## 1. Setup Cloudflare Zero Trust for `sausage.allen.tools`

1. Open the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
2. Go to **Access** > **Applications** > **Add an application** > **Self-hosted**.
3. Set:
   - **Application Name**: `Yellow Rose POS Analytics`
   - **Application domain**: `sausage.allen.tools`
   - **Session Duration**: `1 month` (730 hours) so staff aren't logged out repeatedly.
   - **Cookie Settings**: Disable **Binding Cookie** (Strict IP Binding) so shifting between Wi-Fi and 5G cellular doesn't invalidate sessions.
4. Under **Policies**, create a policy:
   - **Policy Name**: `Staff Email Whitelist`
   - **Action**: `Allow`
   - **Configure rules** > **Include**: Add **Selector: Emails** (you can put your own email initially).

5. **Display Request Access on the Authentication Login Screen**:
   - Because `sausage.allen.tools` is protected by Cloudflare Access, staff who need access will only see the authentication screen where an email is asked.
   - **Automated setup**:
     ```bash
     cd access_agent
     CF_ACCOUNT_ID="<id>" CF_API_TOKEN="<token>" node scripts/configure_login_screen.js
     ```
     Or simply message your Telegram bot: `/setup_login` or *"Configure login screen"*.
   - **Manual Dashboard setup**:
     1. In Cloudflare Zero Trust, go to **Reusable components** > **Custom pages** > **Access login page** > **Manage**.
     2. In **Footer text**, enter:
        `Need dashboard access? Request Access: https://yellow-rose-access-bot.<subdomain>.workers.dev/request-access`
     Now, unapproved staff entering their email will see the Request Access link directly on the authentication prompt and will be redirected to the access portal if blocked.

---

## 2. Making the Page Public (Removing Zero Trust Security)

Now that COGS and sensitive financials are removed, you can make `sausage.allen.tools` completely open to anyone who has the link without asking for any login:

### Option A: 1-Click via Telegram Bot
Message your Telegram bot:
- `/make_public` or *"Make public"*
- The bot sets the Access policy to **Bypass (Everyone)** in real time.

### Option B: Automated CLI Script
```bash
cd access_agent
CF_ACCOUNT_ID="<account-id>" CF_API_TOKEN="<api-token>" node scripts/make_public.js
```
*(To delete the Access application completely from Cloudflare, append `--delete-app`)*.

### Option C: Cloudflare Zero Trust Dashboard
1. Open the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
2. Go to **Access** > **Applications**.
3. Next to `sausage.allen.tools`, either:
   - Click the `...` menu and click **Delete** (completely removes Access protection).
   - Or click **Edit** > **Policies** > Add a policy with **Action: Bypass** and rule **Include: Selector -> Everyone**.

---

## 3. Create Your Telegram Bot

1. Open Telegram and message `@BotFather`.
2. Send `/newbot`, name it (e.g., `YellowRoseAccessBot`), and choose a username.
3. Save the **Bot Token** (format: `123456789:ABCdef...`).
4. Message `@userinfobot` on Telegram to get your numeric **Telegram User ID** (e.g. `123456789`).

---

## 4. Configure Worker Secrets

In the `access_agent/` directory:

```bash
cd access_agent
npx wrangler secret put TELEGRAM_BOT_TOKEN
# Paste your Bot Token

npx wrangler secret put TELEGRAM_ADMIN_IDS
# Paste your numeric Telegram ID (or comma-separated IDs)

npx wrangler secret put CF_ACCOUNT_ID
# Paste your Cloudflare Account ID (from Cloudflare dashboard URL)

npx wrangler secret put CF_API_TOKEN
# Cloudflare API Token with "Zero Trust: Edit" permission
```

---

## 5. Deploy the Worker

```bash
npx wrangler deploy
```

Once deployed, Wrangler will output your worker URL (e.g., `https://yellow-rose-access-bot.<subdomain>.workers.dev`).

---

## 6. Register the Telegram Webhook

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

## 7. Verification & Usage

1. **Staff Requesting Access**:
   - Staff visit `https://sausage.allen.tools` and see the Request Access link directly on the Cloudflare email authentication page (or visit `https://yellow-rose-access-bot.<subdomain>.workers.dev/request-access`).
   - Enter `newcook@yellowrosebbq.com` and submit.
2. **Pitmaster Approving on Telegram**:
   - Your Telegram immediately receives an alert:
     ```
     🔔 Access Request: sausage.allen.tools
     • Email: newcook@yellowrosebbq.com
     • Requester: Dan
     ```
   - Tap **[ ✅ Approve Access ]**.
   - Cloudflare Zero Trust is updated in real-time and the message updates to:
     ```
     ✅ Access Approved
     User newcook@yellowrosebbq.com has been whitelisted on sausage.allen.tools by @pitmaster.
     ```
