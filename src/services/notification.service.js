import prisma from '../database/prisma.js';
import { logger } from '../utils/logger.js';

let botInstance = null;

export const setBotInstanceForNotifications = (bot) => {
  botInstance = bot;
};

export class NotificationService {
  /**
   * Send a Telegram alert to a target user
   * @param {number|BigInt} telegramId
   * @param {number} userId - DB User ID
   * @param {string} type - Alert type (e.g. BUDGET_ALERT, SMART_ALERT, SYSTEM)
   * @param {string} message - Markdown message
   */
  static async sendNotification(telegramId, userId, type, message) {
    try {
      // Save notification to DB
      await prisma.notification.create({
        data: {
          userId,
          type,
          message,
        },
      });

      if (botInstance && telegramId) {
        try {
          await botInstance.telegram.sendMessage(telegramId.toString(), message, {
            parse_mode: 'Markdown',
          });
        } catch (sendErr) {
          logger.warn(`Markdown send failed for telegramId ${telegramId}, falling back to plain text: ${sendErr.message}`);
          await botInstance.telegram.sendMessage(telegramId.toString(), message);
        }
      }
    } catch (error) {
      logger.error(`Failed to send notification to telegramId ${telegramId}:`, error);
    }
  }

  /**
   * Broadcast notification to all users matching specific roles
   * @param {Array<string>} roles - e.g. ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
   * @param {string} type
   * @param {string} message
   */
  static async broadcastToRoles(roles, type, message) {
    try {
      const users = await prisma.user.findMany({
        where: { role: { in: roles } },
      });

      for (const user of users) {
        await this.sendNotification(user.telegramId, user.id, type, message);
      }
    } catch (error) {
      logger.error(`Failed to broadcast notification to roles ${roles.join(',')}:`, error);
    }
  }
}
