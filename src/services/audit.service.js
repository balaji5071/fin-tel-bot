import prisma from '../database/prisma.js';
import { logger } from '../utils/logger.js';

export class AuditService {
  /**
   * Log an audit event
   * @param {Object} params
   * @param {number} params.actorId - User ID performing the action
   * @param {string} params.action - Event action (e.g., EXPENSE_CREATED, USER_PROMOTED)
   * @param {string} params.target - Target entity or user
   * @param {Object} [params.metadata] - Optional additional details
   */
  static async log({ actorId, action, target, metadata = {} }) {
    try {
      const logEntry = await prisma.auditLog.create({
        data: {
          actorId,
          action,
          target,
          metadata: JSON.stringify(metadata),
        },
      });
      logger.info(`[AUDIT LOG] Actor: ${actorId} | Action: ${action} | Target: ${target}`);
      return logEntry;
    } catch (error) {
      logger.error('Failed to write audit log:', error);
    }
  }

  /**
   * Fetch audit logs with optional filtering & pagination
   */
  static async getAuditLogs({ limit = 20, page = 1 } = {}) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              username: true,
              firstName: true,
              telegramId: true,
            },
          },
        },
      }),
      prisma.auditLog.count(),
    ]);

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
