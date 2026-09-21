import { connectDatabase, disconnectDatabase } from './database/prisma.js';
import { launchBot, stopBot } from './bot/index.js';
import { SchedulerService } from './services/scheduler.service.js';
import { logger } from './utils/logger.js';

const main = async () => {
  try {
    logger.info('Starting Enterprise Telegram Finance Bot (Phase 2 - 12)...');

    // 1. Connect to MySQL Database via Prisma
    await connectDatabase();

    // 2. Launch Telegram Bot
    await launchBot();

    // 3. Start Background Scheduler (Recurring, Automated Reports & Smart Alerts)
    SchedulerService.startScheduler();

    // 4. Graceful shutdown listeners
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      SchedulerService.stopScheduler();
      stopBot(signal);
      await disconnectDatabase();
      logger.info('Application stopped cleanly.');
      process.exit(0);
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    logger.error('Fatal error during application startup:', error);
    process.exit(1);
  }
};

main();
