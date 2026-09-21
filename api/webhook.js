import { getBot } from '../src/bot/index.js';
import { config } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';

/**
 * Vercel Serverless Function: Telegram Webhook Handler
 * Telegram sends incoming updates via HTTP POST to this endpoint.
 */
export default async function handler(req, res) {
  // Allow GET requests for health check / confirmation
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'active',
      service: 'Telegram Finance Bot Webhook',
      timestamp: new Date().toISOString(),
      message: 'Send HTTP POST requests with Telegram update payloads to this endpoint.',
    });
  }

  // Reject non-POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Optional Secret Token verification
  if (config.TELEGRAM_WEBHOOK_SECRET) {
    const incomingToken = req.headers['x-telegram-bot-api-secret-token'];
    if (incomingToken !== config.TELEGRAM_WEBHOOK_SECRET) {
      logger.warn('Unauthorized webhook request: secret token mismatch');
      return res.status(401).json({ error: 'Unauthorized: Invalid secret token' });
    }
  }

  try {
    const bot = getBot();

    // Parse body if received as string or Buffer
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        logger.error('Failed to parse webhook JSON body');
        return res.status(400).json({ error: 'Malformed JSON payload' });
      }
    } else if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString('utf-8'));
      } catch {
        logger.error('Failed to parse webhook Buffer body');
        return res.status(400).json({ error: 'Malformed JSON buffer payload' });
      }
    }

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid or missing Telegram update object' });
    }

    // Process update through Telegraf middleware and handlers
    await bot.handleUpdate(body);

    return res.status(200).json({ ok: true });
  } catch (error) {
    logger.error('Error handling Telegram webhook update:', error);
    // Return 200 OK so Telegram does not continuously resend the failing update
    return res.status(200).json({
      ok: false,
      error: error.message,
    });
  }
}
