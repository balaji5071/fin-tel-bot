import { getBot } from '../src/bot/index.js';
import { config } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';

/**
 * Vercel Serverless Function: Webhook Management API
 * Register, inspect, or delete Telegram Webhook easily from browser or CLI.
 *
 * Query Params:
 *  - action: 'set' (default) | 'info' | 'delete'
 *  - url: custom URL override (optional)
 *  - secret: verification token (if TELEGRAM_WEBHOOK_SECRET is configured)
 *  - drop_pending: 'true' | 'false' (drop unprocessed updates)
 */
export default async function handler(req, res) {
  // Authentication check if secret is configured
  if (config.TELEGRAM_WEBHOOK_SECRET) {
    const providedSecret = req.query.secret || req.headers['x-webhook-secret'] || req.headers['authorization']?.replace('Bearer ', '');
    if (providedSecret !== config.TELEGRAM_WEBHOOK_SECRET) {
      return res.status(401).json({
        ok: false,
        error: 'Unauthorized: Missing or invalid secret token parameter (?secret=...)',
      });
    }
  }

  const action = (req.query.action || 'set').toLowerCase();
  const bot = getBot();

  try {
    if (action === 'info') {
      const webhookInfo = await bot.telegram.getWebhookInfo();
      return res.status(200).json({
        ok: true,
        action: 'getWebhookInfo',
        webhookInfo,
      });
    }

    if (action === 'delete') {
      const dropPending = req.query.drop_pending === 'true';
      const result = await bot.telegram.deleteWebhook({ drop_pending_updates: dropPending });
      logger.info('Telegram webhook deleted via /api/set-webhook');
      return res.status(200).json({
        ok: true,
        action: 'deleteWebhook',
        result,
        message: 'Telegram webhook successfully removed. Polling mode can now be used.',
      });
    }

    if (action === 'set') {
      // Determine host / base URL
      let baseUrl = req.query.url || config.APP_URL;

      if (!baseUrl && config.VERCEL_URL) {
        baseUrl = `https://${config.VERCEL_URL}`;
      }

      if (!baseUrl && req.headers.host) {
        const proto = req.headers['x-forwarded-proto'] || 'https';
        baseUrl = `${proto}://${req.headers.host}`;
      }

      if (!baseUrl) {
        return res.status(400).json({
          ok: false,
          error: 'Could not determine deployment URL. Please pass ?url=https://your-domain.vercel.app or set APP_URL in environment.',
        });
      }

      // Ensure proper https protocol and webhook path
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }

      const webhookUrl = baseUrl.endsWith('/api/webhook') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/api/webhook`;

      logger.info(`Registering Telegram webhook URL: ${webhookUrl}`);

      const setWebhookOptions = {
        drop_pending_updates: req.query.drop_pending === 'true',
      };

      if (config.TELEGRAM_WEBHOOK_SECRET) {
        setWebhookOptions.secret_token = config.TELEGRAM_WEBHOOK_SECRET;
      }

      const result = await bot.telegram.setWebhook(webhookUrl, setWebhookOptions);
      const webhookInfo = await bot.telegram.getWebhookInfo();

      return res.status(200).json({
        ok: true,
        action: 'setWebhook',
        result,
        webhookUrl,
        webhookInfo,
        message: 'Telegram webhook successfully registered!',
      });
    }

    return res.status(400).json({
      ok: false,
      error: `Unknown action: "${action}". Supported actions: set, info, delete.`,
    });
  } catch (error) {
    logger.error(`Error executing webhook action "${action}":`, error);
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
