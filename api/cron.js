import { SchedulerService } from '../src/services/scheduler.service.js';
import { getBot } from '../src/bot/index.js';
import { config } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';

/**
 * Vercel Serverless Function: Scheduled Cron Task Trigger
 * Triggered automatically by Vercel Crons or manual monitoring calls.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Security: If CRON_SECRET is configured, require Bearer token
  if (config.CRON_SECRET) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${config.CRON_SECRET}`) {
      logger.warn('Unauthorized cron invocation attempted');
      return res.status(401).json({ error: 'Unauthorized: Invalid CRON_SECRET token' });
    }
  }

  const startTime = Date.now();
  try {
    // Ensure bot instance is loaded for notification dispatches
    getBot();

    logger.info('⏰ Vercel Cron triggered: executing scheduled background tasks...');
    await SchedulerService.runTasks();

    const durationMs = Date.now() - startTime;
    return res.status(200).json({
      status: 'success',
      service: 'Telegram Finance Bot Scheduler',
      executedAt: new Date().toISOString(),
      durationMs,
      tasks: [
        'Due recurring expense processing',
        'Budget and anomaly checks',
        'Automated daily leadership digest (if applicable)',
      ],
    });
  } catch (error) {
    logger.error('Error executing Vercel scheduled cron tasks:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
