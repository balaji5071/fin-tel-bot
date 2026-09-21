import { getBot } from '../src/bot/index.js';
import prisma from '../src/database/prisma.js';
import { config } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';

/**
 * Root Status & Health Dashboard
 * Returns JSON for API clients and a modern HTML dashboard for web browsers.
 */
export default async function handler(req, res) {
  const wantsJson =
    req.query.format === 'json' ||
    (req.headers.accept && req.headers.accept.includes('application/json') && !req.headers.accept.includes('text/html'));

  let dbStatus = 'connecting';
  let dbError = null;
  try {
    // Quick, non-blocking DB check
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'error';
    dbError = err.message;
    logger.warn(`Database check failed in health endpoint: ${err.message}`);
  }

  let botInfo = null;
  let webhookInfo = null;
  try {
    const bot = getBot();
    botInfo = await bot.telegram.getMe();
    webhookInfo = await bot.telegram.getWebhookInfo();
  } catch (err) {
    logger.warn(`Failed to fetch bot/webhook info from Telegram: ${err.message}`);
  }

  const payload = {
    status: dbStatus === 'connected' ? 'healthy' : 'degraded',
    service: 'Enterprise Telegram Finance Bot',
    version: '1.0.0',
    runtime: 'Vercel Serverless (Node.js)',
    nodeVersion: process.version,
    database: {
      status: dbStatus,
      error: dbError,
    },
    telegram: {
      bot: botInfo ? `@${botInfo.username}` : 'unknown',
      webhookUrl: webhookInfo?.url || 'not set (polling or unset)',
      pendingUpdateCount: webhookInfo?.pending_update_count ?? 0,
      lastErrorMessage: webhookInfo?.last_error_message || null,
      hasCustomCertificate: webhookInfo?.has_custom_certificate ?? false,
    },
    timestamp: new Date().toISOString(),
  };

  if (wantsJson) {
    return res.status(200).json(payload);
  }

  // Render sleek, dark-themed HTML Dashboard for browsers
  const isDbOk = dbStatus === 'connected';
  const isWebhookSet = !!(webhookInfo?.url && webhookInfo.url.length > 0);
  const botUsername = botInfo?.username || 'FinanceBot';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Telegram Finance Bot • Vercel Status</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(22, 28, 45, 0.75);
      --card-border: rgba(255, 255, 255, 0.08);
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --accent-green: #10b981;
      --accent-cyan: #06b6d4;
      --accent-blue: #3b82f6;
      --accent-amber: #f59e0b;
      --accent-red: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: radial-gradient(circle at 50% 0%, #1e293b 0%, #090d16 80%);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }
    .container {
      max-width: 680px;
      width: 100%;
    }
    .header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.9rem;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.25);
      color: var(--accent-green);
      font-size: 0.85rem;
      font-weight: 600;
      border-radius: 9999px;
      margin-bottom: 1rem;
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      background: var(--accent-green);
      border-radius: 50%;
      box-shadow: 0 0 10px var(--accent-green);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.9); }
    }
    h1 {
      font-size: 2rem;
      font-weight: 700;
      background: linear-gradient(135deg, #ffffff 0%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    p.subtitle {
      color: var(--text-muted);
      font-size: 0.95rem;
    }
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(12px);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 1.5rem;
      margin-bottom: 1.25rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }
    .card-title {
      font-size: 1rem;
      font-weight: 600;
      color: #e2e8f0;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    @media (max-width: 580px) {
      .grid { grid-template-columns: 1fr; }
    }
    .metric {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 1rem;
    }
    .metric-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.25rem;
    }
    .metric-value {
      font-size: 1.05rem;
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
      color: #f8fafc;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .status-badge.ok {
      background: rgba(16, 185, 129, 0.15);
      color: var(--accent-green);
    }
    .status-badge.warn {
      background: rgba(245, 158, 11, 0.15);
      color: var(--accent-amber);
    }
    .status-badge.err {
      background: rgba(239, 68, 68, 0.15);
      color: var(--accent-red);
    }
    .webhook-box {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      background: #0b1120;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      color: #38bdf8;
      word-break: break-all;
      margin-top: 0.5rem;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 1rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.7rem 1.25rem;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
      border: none;
    }
    .btn-primary {
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: #ffffff;
      box-shadow: 0 4px 15px rgba(2, 132, 199, 0.3);
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #0369a1 0%, #075985 100%);
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.06);
      color: #e2e8f0;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.12);
      transform: translateY(-1px);
    }
    .footer {
      text-align: center;
      margin-top: 1.5rem;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge-pill">
        <span class="badge-dot"></span>
        <span>Vercel Serverless Ready</span>
      </div>
      <h1>Enterprise Finance Bot</h1>
      <p class="subtitle">Real-time Telegram Financial Assistant with AI Insights</p>
    </div>

    <div class="card">
      <div class="card-title">
        <span>System & Service Health</span>
        <span class="status-badge ${isDbOk ? 'ok' : 'err'}">${isDbOk ? 'All Systems Operational' : 'Database Notice'}</span>
      </div>
      <div class="grid">
        <div class="metric">
          <div class="metric-label">Deployment Platform</div>
          <div class="metric-value">▲ Vercel Functions</div>
        </div>
        <div class="metric">
          <div class="metric-label">Node Runtime</div>
          <div class="metric-value">${process.version}</div>
        </div>
        <div class="metric">
          <div class="metric-label">MySQL Database (Prisma)</div>
          <div class="metric-value">
            <span class="status-badge ${isDbOk ? 'ok' : 'err'}">${dbStatus.toUpperCase()}</span>
          </div>
        </div>
        <div class="metric">
          <div class="metric-label">Telegram Bot Account</div>
          <div class="metric-value">@${botUsername}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>Telegram Webhook Status</span>
        <span class="status-badge ${isWebhookSet ? 'ok' : 'warn'}">
          ${isWebhookSet ? 'WEBHOOK ACTIVE' : 'NO WEBHOOK SET'}
        </span>
      </div>
      <div class="metric-label">Registered Webhook URL</div>
      <div class="webhook-box">${webhookInfo?.url || 'No webhook registered yet with Telegram.'}</div>
      ${
        webhookInfo?.pending_update_count
          ? `<p style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--accent-amber);">⚠️ Pending updates: ${webhookInfo.pending_update_count}</p>`
          : ''
      }
      ${
        webhookInfo?.last_error_message
          ? `<p style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--accent-red);">❌ Last Telegram error: ${webhookInfo.last_error_message}</p>`
          : ''
      }

      <div class="actions">
        <a href="https://t.me/${botUsername}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
          💬 Open in Telegram
        </a>
        <a href="/api/set-webhook" class="btn btn-secondary">
          ⚡ Set Webhook Here
        </a>
        <a href="/api/set-webhook?action=info" class="btn btn-secondary">
          🔍 Webhook Info
        </a>
        <a href="/api?format=json" class="btn btn-secondary">
          📄 JSON Health API
        </a>
      </div>
    </div>

    <div class="footer">
      Enterprise Telegram Finance Bot • Phase 2 - 12 • Built with Node.js, Telegraf, Prisma & Groq AI
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
