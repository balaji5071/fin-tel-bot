# 🚀 Deploying Telegram Finance Bot to Vercel

This guide outlines the end-to-end process of deploying your **Enterprise Telegram Finance Bot** as a serverless application on **Vercel**.

---

## 🏗️ Architecture Overview

On standard servers or VPS, Telegram bots run continuously using **long polling** (`bot.launch()`). On **Vercel Serverless Functions**, applications run ephemerally and respond to events on demand.

To achieve lightning-fast, scalable, and zero-maintenance execution:
- **Telegram Updates via Webhook**: Telegram pushes messages via HTTP POST to `/api/webhook`.
- **Async Safety**: Telegraf is configured with `webhookReply: false` so database operations, Groq AI completions, and follow-up replies finish completely before the serverless function exits.
- **Automated Cron Jobs**: Background scheduler tasks (recurring expenses, smart anomaly checks, and daily summaries) run on schedule via Vercel Crons (`/api/cron`).
- **Interactive Status Dashboard**: Visiting the root URL (`/` or `/api`) displays a real-time web dashboard showing database connectivity and webhook health.

---

## 🗄️ Step 1: Cloud MySQL Database Setup

Vercel functions need a cloud-hosted MySQL database with public connectivity and SSL support. 

Any of the following providers will work seamlessly:
- **[Aiven for MySQL](https://aiven.io/)** (Free tier available)
- **[TiDB Cloud](https://tidbcloud.com/)** (Generous free tier MySQL compatible)
- **[Railway](https://railway.app/)** (One-click MySQL template)
- **[PlanetScale](https://planetscale.com/)** (High performance MySQL serverless)
- **[AWS RDS / DigitalOcean Managed DB](https://digitalocean.com/)**

Make sure your database connection string has SSL enabled if required (e.g. `?sslaccept=strict` or `?ssl={"rejectUnauthorized":true}`).

Run database migrations to your cloud database before deploying:
```bash
DATABASE_URL="your-cloud-mysql-connection-url" npm run db:push
```

---

## 🌐 Step 2: Deploy to Vercel

### Method A: Deploy via GitHub (Recommended)

1. Commit and push your latest code to GitHub:
   ```bash
   git add .
   git commit -m "feat: vercel serverless ready"
   git push origin main
   ```
2. Open the [Vercel Dashboard](https://vercel.com/new).
3. Select **Import Git Repository** and choose your `fin-tel-bot` repository.
4. Keep the default settings:
   - **Framework Preset**: `Other`
   - **Root Directory**: `./`
   - **Build Command**: `prisma generate` (automatically picked up from `package.json`)
   - **Output Directory**: Leave empty

### Method B: Deploy via Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login and deploy
vercel
```

---

## 🔑 Step 3: Configure Environment Variables

In your Vercel Project Dashboard, navigate to **Settings** → **Environment Variables** and add the following:

| Variable | Description | Required? | Example |
| :--- | :--- | :--- | :--- |
| `BOT_TOKEN` | Telegram Bot Token from [@BotFather](https://t.me/BotFather) | **Yes** | `8880325169:AAFl...` |
| `DATABASE_URL` | Cloud MySQL connection string | **Yes** | `mysql://user:pass@host:3306/db?sslaccept=strict` |
| `GROQ_API_KEY` | Groq Cloud API Key for Conversational AI | **Yes** | `gsk_...` |
| `SUPER_ADMIN_IDS` | Telegram User IDs of Super Admins (comma-separated) | **Yes** | `8530973341` |
| `ADMIN_IDS` | Telegram User IDs of Admins (comma-separated) | No | `123456789,987654321` |
| `GROQ_MODEL` | LLM model name | No | `openai/gpt-oss-120b` or `llama-3.3-70b-versatile` |
| `NODE_ENV` | Application environment | No | `production` |
| `APP_URL` | Your production Vercel domain | Recommended | `https://fin-tel-bot.vercel.app` |
| `TELEGRAM_WEBHOOK_SECRET` | Optional secret to authenticate incoming Telegram updates | Optional | `random_32_char_secret` |
| `CRON_SECRET` | Optional token to secure Vercel Cron invocations | Optional | `random_cron_secret` |

*Note: Whenever you modify environment variables in Vercel, trigger a **Redeploy** so they take effect.*

---

## ⚡ Step 4: Register the Telegram Webhook

Once deployed, your bot needs Telegram to route messages to `https://your-domain.vercel.app/api/webhook`.

Choose any of the 3 easy ways below:

### Option 1: One-Click Browser Registration
Simply visit this URL in your browser:
```
https://your-domain.vercel.app/api/set-webhook
```
*(If you configured `TELEGRAM_WEBHOOK_SECRET`, append `?secret=your_secret`)*

You will see an instant confirmation JSON:
```json
{
  "ok": true,
  "action": "setWebhook",
  "result": true,
  "webhookUrl": "https://your-domain.vercel.app/api/webhook",
  "message": "Telegram webhook successfully registered!"
}
```

### Option 2: Using the Local CLI Script
From your local terminal:
```bash
# Check current webhook status
npm run webhook:info

# Register your Vercel deployment URL
npm run webhook:set https://your-domain.vercel.app
```

### Option 3: Direct cURL
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://your-domain.vercel.app/api/webhook"
```

---

## 📊 Step 5: Test & Verify

1. **Status Dashboard**: Visit `https://your-domain.vercel.app/` in your browser. You will see:
   - ✅ System & Service Health
   - 🟢 MySQL Database Connection status
   - 🤖 Authenticated Telegram Bot link (`@broskieshub_finance_bot`)
   - 📡 Registered Webhook details
2. **Telegram Test**:
   - Open Telegram and message your bot (`/start`).
   - Send `/founder` or `/daily` to verify database analytics.
   - Send a voice note or natural language expense (e.g., *"Spent 350 on team pizza today"*).

---

## ⏰ Cron Jobs & Scheduled Tasks

`vercel.json` is configured with:
```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 9 * * *"
    }
  ]
}
```
- On **Vercel Hobby**: Crons run once daily (default: 9 AM UTC, triggering the Automated Daily Leadership Digest and processing recurring expenses).
- On **Vercel Pro**: You can adjust `"schedule": "0 * * * *"` to run every hour.
- You can also manually trigger cron tasks anytime by hitting `GET https://your-domain.vercel.app/api/cron`.

---

## 🔄 Switching Back to Local Development (Polling Mode)

If you wish to test locally using polling mode:
```bash
# 1. Remove the webhook so Telegram allows polling
npm run webhook:delete

# 2. Start local polling with auto-reload
npm run dev
```
*(Note: `launchBot()` automatically checks and deletes lingering webhooks when launched locally, so switching is completely seamless!)*
