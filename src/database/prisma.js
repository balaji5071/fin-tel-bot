import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

let prisma;

if (!global.__prisma__) {
  global.__prisma__ = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'stdout', level: 'error' },
      { emit: 'stdout', level: 'warn' },
    ],
  });
}

prisma = global.__prisma__;

export const connectDatabase = async () => {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully via Prisma');
  } catch (error) {
    logger.error('❌ Failed to connect to the database:', error);
    process.exit(1);
  }
};

export const disconnectDatabase = async () => {
  try {
    await prisma.$disconnect();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error disconnecting from database:', error);
  }
};

export default prisma;
