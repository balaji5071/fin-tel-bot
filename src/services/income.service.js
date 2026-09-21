import prisma from '../database/prisma.js';
import { logger } from '../utils/logger.js';
import { AuditService } from './audit.service.js';

export class IncomeService {
  /**
   * Add a new income record and update cash balance
   */
  static async addIncome({ userId, amount, source, description, receivedAt = new Date(), department = 'General' }) {
    try {
      const income = await prisma.income.create({
        data: {
          userId,
          amount,
          source: source || 'General Income',
          description: description || null,
          receivedAt: new Date(receivedAt),
          department,
        },
        include: { user: true },
      });

      // Audit Log
      await AuditService.log({
        actorId: userId,
        action: 'INCOME_CREATED',
        target: `Income #${income.id}`,
        metadata: { amount, source, description, department },
      });

      // Update cash balance automatically if cash balance record exists
      const currentCash = await prisma.cashBalance.findFirst();
      if (currentCash) {
        await prisma.cashBalance.update({
          where: { id: currentCash.id },
          data: {
            amount: currentCash.amount + amount,
            updatedBy: userId,
          },
        });
      }

      logger.info(`Income recorded: ID #${income.id}, Amount ₹${amount} from "${source}"`);
      return income;
    } catch (error) {
      logger.error('Error recording income:', error);
      throw error;
    }
  }

  /**
   * Get Monthly Income report
   */
  static async getMonthlyIncome(month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const incomes = await prisma.income.findMany({
      where: {
        receivedAt: { gte: startOfMonth, lte: endOfMonth },
      },
      include: { user: true },
      orderBy: { receivedAt: 'desc' },
    });

    const totalIncome = incomes.reduce((sum, item) => sum + item.amount, 0);

    const sourceMap = {};
    incomes.forEach((inc) => {
      sourceMap[inc.source] = (sourceMap[inc.source] || 0) + inc.amount;
    });

    return {
      month,
      year,
      totalIncome,
      count: incomes.length,
      sourceBreakdown: Object.entries(sourceMap).map(([source, amount]) => ({ source, amount })),
      incomes,
    };
  }

  /**
   * Get Cashflow report comparing income vs expenses
   */
  static async getCashflowReport(month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const [incomes, expenses, cashRecord] = await Promise.all([
      prisma.income.findMany({
        where: { receivedAt: { gte: startOfMonth, lte: endOfMonth } },
      }),
      prisma.expense.findMany({
        where: { isDeleted: false, createdAt: { gte: startOfMonth, lte: endOfMonth } },
      }),
      prisma.cashBalance.findFirst(),
    ]);

    const totalInflow = incomes.reduce((sum, i) => sum + i.amount, 0);
    const totalOutflow = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netCashflow = totalInflow - totalOutflow;
    const currentBankCash = cashRecord ? cashRecord.amount : 0;

    return {
      month,
      year,
      totalInflow,
      totalOutflow,
      netCashflow,
      isPositive: netCashflow >= 0,
      currentBankCash,
      incomeCount: incomes.length,
      expenseCount: expenses.length,
    };
  }
}
