import prisma from '../database/prisma.js';
import { logger } from '../utils/logger.js';
import { ExpenseService } from './expense.service.js';
import { AuditService } from './audit.service.js';

export class RecurringExpenseService {
  /**
   * Add a recurring expense schedule
   */
  static async addRecurringExpense({ userId, amount, category, frequency, note }) {
    const nextRun = this.calculateNextRun(new Date(), frequency);

    const recurring = await prisma.recurringExpense.create({
      data: {
        userId,
        amount,
        category,
        frequency,
        note,
        nextRun,
      },
    });

    await AuditService.log({
      actorId: userId,
      action: 'RECURRING_EXPENSE_CREATED',
      target: `Recurring #${recurring.id}`,
      metadata: { amount, category, frequency, note },
    });

    logger.info(`Recurring expense #${recurring.id} scheduled for ${frequency}`);
    return recurring;
  }

  /**
   * Process all due recurring expenses
   */
  static async processDueRecurringExpenses() {
    const now = new Date();

    const dueList = await prisma.recurringExpense.findMany({
      where: {
        active: true,
        nextRun: { lte: now },
      },
    });

    for (const item of dueList) {
      try {
        // Auto-create expense
        await ExpenseService.addExpense({
          userId: item.userId,
          amount: item.amount,
          category: item.category,
          note: `[Auto-Recurring] ${item.note || ''}`,
          department: item.department || 'General',
        });

        // Update next run date
        const newNextRun = this.calculateNextRun(item.nextRun, item.frequency);
        await prisma.recurringExpense.update({
          where: { id: item.id },
          data: { nextRun: newNextRun },
        });

        logger.info(`Processed recurring expense #${item.id}, next run: ${newNextRun}`);
      } catch (err) {
        logger.error(`Error processing recurring expense #${item.id}:`, err);
      }
    }
  }

  /**
   * Calculate next run date based on frequency
   */
  static calculateNextRun(baseDate, frequency) {
    const date = new Date(baseDate);
    switch (frequency.toUpperCase()) {
      case 'DAILY':
        date.setDate(date.getDate() + 1);
        break;
      case 'WEEKLY':
        date.setDate(date.getDate() + 7);
        break;
      case 'MONTHLY':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'YEARLY':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        date.setDate(date.getDate() + 1);
    }
    return date;
  }
}
