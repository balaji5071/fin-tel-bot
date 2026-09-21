import prisma from '../database/prisma.js';
import { logger } from '../utils/logger.js';
import { AuditService } from './audit.service.js';

export class BalanceService {
  /**
   * Fetch current opening balance configured in the settings table
   * @returns {Promise<number>}
   */
  static async getOpeningBalance() {
    try {
      const setting = await prisma.setting.findFirst({
        orderBy: { id: 'asc' },
      });
      return setting ? setting.openingBalance : 0;
    } catch (error) {
      logger.error('Error fetching opening balance from settings:', error);
      return 0;
    }
  }

  /**
   * Set or update company opening balance
   * @param {number} amount
   * @param {number} actorUserId
   */
  static async setOpeningBalance(amount, actorUserId) {
    try {
      const existing = await prisma.setting.findFirst({
        orderBy: { id: 'asc' },
      });

      let updated;
      if (existing) {
        updated = await prisma.setting.update({
          where: { id: existing.id },
          data: { openingBalance: amount },
        });
      } else {
        updated = await prisma.setting.create({
          data: { openingBalance: amount },
        });
      }

      await AuditService.log({
        actorId: actorUserId,
        action: 'OPENING_BALANCE_UPDATED',
        target: 'Company Opening Balance',
        metadata: { previous: existing?.openingBalance || 0, updated: amount },
      });

      logger.info(`Opening balance updated to ₹${amount} by user ${actorUserId}`);
      return updated.openingBalance;
    } catch (error) {
      logger.error('Error updating opening balance:', error);
      throw error;
    }
  }

  /**
   * Calculate Authoritative Current Balance strictly from database queries
   *
   * Formula:
   * Current Balance = Opening Balance + Total Income - Total Expenses
   *
   * @returns {Promise<{
   *   openingBalance: number,
   *   totalIncome: number,
   *   totalExpenses: number,
   *   currentBalance: number,
   *   incomeCount: number,
   *   expenseCount: number
   * }>}
   */
  static async calculateCurrentBalance() {
    try {
      const [openingBalance, incomeAgg, expenseAgg] = await Promise.all([
        this.getOpeningBalance(),
        prisma.income.aggregate({
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.expense.aggregate({
          where: { isDeleted: false },
          _sum: { amount: true },
          _count: { id: true },
        }),
      ]);

      const totalIncome = incomeAgg._sum.amount || 0;
      const incomeCount = incomeAgg._count.id || 0;

      const totalExpenses = expenseAgg._sum.amount || 0;
      const expenseCount = expenseAgg._count.id || 0;

      const currentBalance = openingBalance + totalIncome - totalExpenses;

      return {
        openingBalance,
        totalIncome,
        totalExpenses,
        currentBalance,
        incomeCount,
        expenseCount,
      };
    } catch (error) {
      logger.error('Error calculating current balance:', error);
      throw error;
    }
  }

  /**
   * Fully traceable Balance Audit breakdown
   * Returns line-item incomes, expenses, opening balance, totals, and formula.
   *
   * @param {Object} [options]
   * @param {number} [options.limit=20]
   */
  static async getBalanceAudit({ limit = 20 } = {}) {
    try {
      const [openingBalance, incomes, incomeAgg, expenses, expenseAgg] = await Promise.all([
        this.getOpeningBalance(),
        prisma.income.findMany({
          take: limit,
          orderBy: { receivedAt: 'desc' },
        }),
        prisma.income.aggregate({
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.expense.findMany({
          where: { isDeleted: false },
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.expense.aggregate({
          where: { isDeleted: false },
          _sum: { amount: true },
          _count: { id: true },
        }),
      ]);

      const totalIncome = incomeAgg._sum.amount || 0;
      const incomeCount = incomeAgg._count.id || 0;

      const totalExpenses = expenseAgg._sum.amount || 0;
      const expenseCount = expenseAgg._count.id || 0;

      const currentBalance = openingBalance + totalIncome - totalExpenses;

      return {
        currentBalance,
        openingBalance,
        incomes: incomes.map((i) => ({
          id: i.id,
          amount: i.amount,
          source: i.source,
          description: i.description || i.source,
          receivedAt: i.receivedAt,
        })),
        totalIncome,
        expenses: expenses.map((e) => ({
          id: e.id,
          amount: e.amount,
          note: e.note || e.category,
          category: e.category,
          createdAt: e.createdAt,
        })),
        totalExpenses,
        incomeCount,
        expenseCount,
        formula: 'Opening Balance + Total Income - Total Expenses = Current Balance',
      };
    } catch (error) {
      logger.error('Error generating balance audit:', error);
      throw error;
    }
  }

  /**
   * Atomically purge all financial records and reset balance
   * ONLY invoked when explicitly confirmed via two-step confirmation
   *
   * @param {Object} actorUser
   */
  static async resetAllFinancialData(actorUser) {
    try {
      logger.warn(`CRITICAL: Starting full financial data reset initiated by ${actorUser.id} (${actorUser.firstName})`);

      const result = await prisma.$transaction(async (tx) => {
        // Count before deleting for audit reporting
        const [expenseCount, incomeCount, receiptCount] = await Promise.all([
          tx.expense.count(),
          tx.income.count(),
          tx.expenseReceipt.count(),
        ]);

        // 1. Delete Receipts
        await tx.expenseReceipt.deleteMany({});

        // 2. Delete Expenses
        await tx.expense.deleteMany({});

        // 3. Delete Incomes
        await tx.income.deleteMany({});

        // 4. Delete Recurring Expenses
        await tx.recurringExpense.deleteMany({});

        // 5. Reset Settings opening balance to 0
        const existingSetting = await tx.setting.findFirst();
        if (existingSetting) {
          await tx.setting.update({
            where: { id: existingSetting.id },
            data: { openingBalance: 0 },
          });
        }

        // 6. Reset CashBalance to 0
        const existingCash = await tx.cashBalance.findFirst();
        if (existingCash) {
          await tx.cashBalance.update({
            where: { id: existingCash.id },
            data: { amount: 0, updatedBy: actorUser.id },
          });
        }

        // 7. Clear conversation history to start fresh
        await tx.conversationMessage.deleteMany({});

        return {
          deletedExpenses: expenseCount,
          deletedIncomes: incomeCount,
          deletedReceipts: receiptCount,
        };
      });

      // Audit Log the reset
      await AuditService.log({
        actorId: actorUser.id,
        action: 'ADMIN_DATA_RESET',
        target: 'All Financial Records',
        metadata: result,
      });

      logger.info('Financial records successfully wiped via admin reset.');
      return result;
    } catch (error) {
      logger.error('Failed to execute admin financial data reset:', error);
      throw error;
    }
  }
}
