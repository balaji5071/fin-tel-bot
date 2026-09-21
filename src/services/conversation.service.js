import prisma from '../database/prisma.js';
import { logger } from '../utils/logger.js';

export class ConversationService {
  /**
   * Save a conversational message to database
   * @param {Object} params
   * @param {number} params.userId
   * @param {'user' | 'assistant'} params.role
   * @param {string} params.content
   * @param {string} [params.intent]
   * @param {Object} [params.metadata]
   */
  static async logMessage({ userId, role, content, intent = null, metadata = null }) {
    try {
      return await prisma.conversationMessage.create({
        data: {
          userId,
          role,
          content,
          intent,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });
    } catch (error) {
      logger.warn(`Failed to log conversation message for user ${userId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Retrieve recent conversation history for context (ordered chronologically)
   * @param {number} userId
   * @param {number} [limit=6]
   * @returns {Promise<Array<{role: string, content: string}>>}
   */
  static async getRecentHistory(userId, limit = 6) {
    try {
      const messages = await prisma.conversationMessage.findMany({
        where: { userId },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      // Reverse so oldest of the window is first
      return messages.reverse().map((m) => ({
        role: m.role,
        content: m.content,
      }));
    } catch (error) {
      logger.warn(`Failed to retrieve conversation history for user ${userId}: ${error.message}`);
      return [];
    }
  }
}
