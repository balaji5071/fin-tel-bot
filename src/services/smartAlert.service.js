import prisma from '../database/prisma.js';
import { logger } from '../utils/logger.js';
import { NotificationService } from './notification.service.js';
import { escapeMd } from '../utils/markdown.js';

export class SmartAlertService {
  /**
   * Run smart anomaly detection routines
   */
  static async checkAnomalies() {
    try {
      await this.checkDuplicateExpenses();
      await this.checkSpendingSpikes();
      await this.checkMissingReceipts();
    } catch (error) {
      logger.error('Error running smart alerts:', error);
    }
  }

  /**
   * Detect potential duplicate expenses logged within the last 1 hour
   */
  static async checkDuplicateExpenses() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentExpenses = await prisma.expense.findMany({
      where: {
        isDeleted: false,
        createdAt: { gte: oneHourAgo },
      },
      include: { user: true },
    });

    const seen = new Map();
    for (const exp of recentExpenses) {
      const key = `${exp.userId}-${exp.amount}-${exp.category}`;
      if (seen.has(key)) {
        const prev = seen.get(key);
        const fmtAmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(exp.amount);
        const userName = escapeMd(exp.user.firstName);
        const catName = escapeMd(exp.category);
        const alertMsg =
          `⚡ *Smart Alert: Potential Duplicate Expense Detected*\n\n` +
          `User *${userName}* logged two identical expenses of ${fmtAmt} under category *${catName}* within 1 hour.\n` +
          `• Expense IDs: #${prev.id} and #${exp.id}`;

        await NotificationService.broadcastToRoles(['SUPER_ADMIN', 'ADMIN', 'MANAGER'], 'SMART_ALERT', alertMsg);
      } else {
        seen.set(key, exp);
      }
    }
  }

  /**
   * Detect unusually high single transactions
   */
  static async checkSpendingSpikes() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const largeExpenses = await prisma.expense.findMany({
      where: {
        isDeleted: false,
        createdAt: { gte: todayStart },
        amount: { gte: 10000 }, // High transaction threshold (₹10,000)
      },
      include: { user: true },
    });

    for (const exp of largeExpenses) {
      const fmtAmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(exp.amount);
      const userName = escapeMd(exp.user.firstName);
      const catName = escapeMd(exp.category);
      const noteStr = escapeMd(exp.note || 'None');
      const alertMsg =
        `⚡ *Smart Alert: High Spending Spike Detected*\n\n` +
        `User *${userName}* logged a large expense of *${fmtAmt}* for *${catName}*.\n` +
        `📝 Note: ${noteStr}`;

      await NotificationService.broadcastToRoles(['SUPER_ADMIN', 'ADMIN', 'MANAGER'], 'SPENDING_SPIKE', alertMsg);
    }
  }

  /**
   * Detect large expenses missing receipts
   */
  static async checkMissingReceipts() {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const expensesMissingReceipts = await prisma.expense.findMany({
      where: {
        isDeleted: false,
        amount: { gte: 1000 }, // Threshold (₹1,000)
        createdAt: { gte: threeDaysAgo },
        receipts: { none: {} },
      },
      include: { user: true },
    });

    if (expensesMissingReceipts.length > 0) {
      const alertMsg =
        `⚠️ *Smart Alert: Missing Receipts*\n\n` +
        `There are ${expensesMissingReceipts.length} expenses over ₹1,000 missing receipt uploads.\n` +
        `Please attach receipts using photo uploads on Telegram.`;

      await NotificationService.broadcastToRoles(['SUPER_ADMIN', 'ADMIN', 'MANAGER'], 'MISSING_RECEIPTS', alertMsg);
    }
  }
}
