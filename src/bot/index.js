import { Telegraf } from 'telegraf';
import https from 'node:https';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ensureUser } from './middleware/auth.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { registerCommands } from './handlers/command.handler.js';
import { setBotInstanceForNotifications } from '../services/notification.service.js';

let bot;

// HTTPS Agent to optimize DNS lookup and handle slow/unstable connection
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 10000,
  family: 4, // Force IPv4 to prevent dual-stack IPv6 DNS resolution timeouts
  timeout: 30000,
});

export const initBot = () => {
  bot = new Telegraf(config.BOT_TOKEN, {
    telegram: {
      agent: httpsAgent,
    },
  });

  // Set bot instance for notification dispatching
  setBotInstanceForNotifications(bot);

  // Global Middleware
  bot.use(ensureUser);

  // Error Handler
  bot.catch(errorHandler);

  // Register commands
  registerCommands(bot);

  return bot;
};

export const launchBot = async (maxRetries = 5, retryDelayMs = 3000) => {
  if (!bot) {
    initBot();
  }

  logger.info('🚀 Starting Telegram Bot polling...');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await bot.launch();
      logger.info('✅ Telegram Bot launched successfully');
      return;
    } catch (error) {
      logger.warn(`⚠️ Telegram connection attempt ${attempt}/${maxRetries} failed: ${error.message}`);
      if (attempt === maxRetries) {
        throw error;
      }
      logger.info(`Retrying in ${retryDelayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
};

export const stopBot = (reason = 'SIGINT') => {
  if (bot) {
    logger.info(`Stopping Telegram Bot (${reason})...`);
    bot.stop(reason);
  }
};

