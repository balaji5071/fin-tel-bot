import prisma from '../database/prisma.js';
import { logger } from '../utils/logger.js';
import { AuditService } from './audit.service.js';
import { BudgetService } from './budget.service.js';
import { VendorService } from './vendor.service.js';

export class ExpenseService {
  /**
   * Add a new expense with optional vendor auto-matching
   */
  static async addExpense({ userId, amount, category, note, vendorName, department = 'General' }) {
    try {
      let vendorId = null;
      if (vendorName) {
        const vendor = await VendorService.findOrCreateVendor(vendorName);
        if (vendor) vendorId = vendor.id;
      }

      const expense = await prisma.expense.create({
        data: {
          userId,
          amount,
          category,
          note,
          vendorId,
          department,
        },
        include: {
          user: true,
          vendor: true,
        },
      });

      // Audit Log
      await AuditService.log({
        actorId: userId,
        action: 'EXPENSE_CREATED',
        target: `Expense #${expense.id}`,
        metadata: { amount, category, note, department, vendor: vendorName },
      });

      // Trigger automatic budget check
      const monthlyReport = await this.getMonthlyReport();
      await BudgetService.checkBudgetAlerts(monthlyReport.totalSpent);

      logger.info(`Expense recorded: ID ${expense.id}, Amount ${amount}, Category ${category}`);
      return expense;
    } catch (error) {
      logger.error('Error creating expense:', error);
      throw error;
    }
  }

  /**
   * Edit an existing expense
   */
  static async editExpense(expenseId, actorUser, updates) {
    const existing = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!existing || existing.isDeleted) {
      throw new Error(`Expense #${expenseId} not found.`);
    }

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: updates,
      include: { user: true, vendor: true },
    });

    await AuditService.log({
      actorId: actorUser.id,
      action: 'EXPENSE_UPDATED',
      target: `Expense #${expenseId}`,
      metadata: { previous: existing, updated: updates },
    });

    return updated;
  }

  /**
   * Soft delete an expense
   */
  static async softDeleteExpense(expenseId, actorUser) {
    const existing = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!existing || existing.isDeleted) {
      throw new Error(`Expense #${expenseId} not found or already deleted.`);
    }

    const deleted = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: actorUser.id,
      },
    });

    await AuditService.log({
      actorId: actorUser.id,
      action: 'EXPENSE_DELETED',
      target: `Expense #${expenseId}`,
      metadata: { amount: existing.amount, category: existing.category },
    });

    return deleted;
  }

  /**
   * Get expense history with category, days, user filtering and pagination
   */
  static async getExpenseHistory({ userId, userRole, category, days, page = 1, limit = 5 } = {}) {
    const skip = (page - 1) * limit;

    const where = {
      isDeleted: false,
    };

    // Employee role can only view their own expenses unless role is elevated
    if (userRole === 'EMPLOYEE' && userId) {
      where.userId = userId;
    }

    if (category) {
      where.category = { equals: category, mode: 'insensitive' };
    }

    if (days) {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);
      where.createdAt = { gte: sinceDate };
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
          vendor: true,
        },
      }),
      prisma.expense.count({ where }),
    ]);

    return {
      expenses,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Daily Report
   */
  static async getDailyReport(targetDate = new Date()) {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const expenses = await prisma.expense.findMany({
      where: {
        isDeleted: false,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      include: { user: true, vendor: true },
      orderBy: { createdAt: 'desc' },
    });

    const totalSpent = expenses.reduce((sum, item) => sum + item.amount, 0);
    const count = expenses.length;

    const categoriesMap = {};
    expenses.forEach((item) => {
      if (!categoriesMap[item.category]) {
        categoriesMap[item.category] = { amount: 0, count: 0 };
      }
      categoriesMap[item.category].amount += item.amount;
      categoriesMap[item.category].count += 1;
    });

    return {
      date: startOfDay,
      totalSpent,
      count,
      categoryBreakdown: Object.entries(categoriesMap).map(([category, data]) => ({
        category,
        amount: data.amount,
        count: data.count,
      })),
      expenses,
    };
  }

  /**
   * Monthly Report
   */
  static async getMonthlyReport(month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const expenses = await prisma.expense.findMany({
      where: {
        isDeleted: false,
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
      include: { user: true, vendor: true },
      orderBy: { createdAt: 'desc' },
    });

    const totalSpent = expenses.reduce((sum, item) => sum + item.amount, 0);
    const count = expenses.length;

    const categoriesMap = {};
    expenses.forEach((item) => {
      if (!categoriesMap[item.category]) {
        categoriesMap[item.category] = { amount: 0, count: 0 };
      }
      categoriesMap[item.category].amount += item.amount;
      categoriesMap[item.category].count += 1;
    });

    const categoryBreakdown = Object.entries(categoriesMap)
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        count: data.count,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      month,
      year,
      totalSpent,
      count,
      categoryBreakdown,
      topCategory: categoryBreakdown.length > 0 ? categoryBreakdown[0] : null,
      expenses,
    };
  }

  /**
   * Record multiple expenses in an atomic transaction
   */
  static async addBulkExpenses({ userId, transactions, department = 'General' }) {
    if (!transactions || transactions.length === 0) {
      throw new Error('No transactions provided for bulk entry.');
    }

    try {
      const createdExpenses = await prisma.$transaction(async (tx) => {
        const results = [];
        for (const item of transactions) {
          let vendorId = null;
          if (item.vendor) {
            const vendor = await VendorService.findOrCreateVendor(item.vendor);
            if (vendor) vendorId = vendor.id;
          }

          let createdAt = new Date();
          if (item.date && item.date === 'yesterday') {
            createdAt.setDate(createdAt.getDate() - 1);
          } else if (item.date && item.date !== 'today') {
            const parsedD = new Date(item.date);
            if (!isNaN(parsedD.getTime())) createdAt = parsedD;
          }

          const exp = await tx.expense.create({
            data: {
              userId,
              amount: item.amount,
              category: item.category || 'Misc',
              note: item.description || 'Expense',
              vendorId,
              department,
              createdAt,
            },
            include: { user: true, vendor: true },
          });

          results.push(exp);
        }
        return results;
      });

      const totalAmount = createdExpenses.reduce((sum, e) => sum + e.amount, 0);

      // Audit Log
      await AuditService.log({
        actorId: userId,
        action: 'BULK_EXPENSE_CREATED',
        target: `${createdExpenses.length} Expenses`,
        metadata: { count: createdExpenses.length, totalAmount },
      });

      // Trigger automatic budget check
      const monthlyReport = await this.getMonthlyReport();
      await BudgetService.checkBudgetAlerts(monthlyReport.totalSpent);

      return {
        count: createdExpenses.length,
        total: totalAmount,
        expenses: createdExpenses,
      };
    } catch (error) {
      logger.error('Error adding bulk expenses:', error);
      throw error;
    }
  }

  /**
   * Search expenses with fuzzy match and advanced filters
   */
  static async searchExpenses({ userId, userRole, keyword, category, vendor, days, minAmount, maxAmount, limit = 10 }) {
    const where = {
      isDeleted: false,
    };

    if (userRole === 'EMPLOYEE' && userId) {
      where.userId = userId;
    }

    if (category) {
      where.category = { contains: category };
    }

    if (keyword) {
      where.OR = [
        { note: { contains: keyword } },
        { category: { contains: keyword } },
      ];
    }

    if (vendor) {
      where.vendor = { name: { contains: vendor } };
    }

    if (days) {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);
      where.createdAt = { gte: sinceDate };
    }

    if (minAmount !== undefined || maxAmount !== undefined) {
      where.amount = {};
      if (minAmount !== undefined) where.amount.gte = minAmount;
      if (maxAmount !== undefined) where.amount.lte = maxAmount;
    }

    const expenses = await prisma.expense.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: true, vendor: true },
    });

    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

    return {
      count: expenses.length,
      totalSpent,
      expenses,
    };
  }

  /**
   * Find most recent matching expense for contextual conversational actions
   */
  static async findRecentMatchingExpense({ userId, query, date = 'today', amount, category }) {
    const where = {
      isDeleted: false,
      userId,
    };

    if (date === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      where.createdAt = { gte: startOfDay };
    } else if (date === 'yesterday') {
      const startOfYesterday = new Date();
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);
      startOfYesterday.setHours(0, 0, 0, 0);
      const endOfYesterday = new Date();
      endOfYesterday.setDate(endOfYesterday.getDate() - 1);
      endOfYesterday.setHours(23, 59, 59, 999);
      where.createdAt = { gte: startOfYesterday, lte: endOfYesterday };
    }

    if (amount) {
      where.amount = amount;
    }

    if (category) {
      where.category = { contains: category };
    }

    if (query) {
      const cleaned = query
        .replace(/\b(the|a|an|expense|expenses|i|added|logged|my|today|yesterday|that|this)\b/gi, '')
        .trim();

      const searchTerms = Array.from(new Set([query, cleaned].filter((t) => t && t.length > 0)));
      if (searchTerms.length > 0) {
        where.OR = searchTerms.flatMap((term) => [
          { note: { contains: term } },
          { category: { contains: term } },
        ]);
      }
    }

    return prisma.expense.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: true, vendor: true },
    });
  }

  /**
   * Compare Month-over-Month expenses (MoM cost analysis)
   */
  static async compareMonths(currentMonth, currentYear, previousMonth, previousYear) {
    const [currentReport, previousReport] = await Promise.all([
      this.getMonthlyReport(currentMonth, currentYear),
      this.getMonthlyReport(previousMonth, previousYear),
    ]);

    const currentSpend = currentReport.totalSpent;
    const previousSpend = previousReport.totalSpent;
    const deltaAmount = currentSpend - previousSpend;
    const percentageChange = previousSpend > 0
      ? ((deltaAmount / previousSpend) * 100).toFixed(1)
      : (currentSpend > 0 ? 100 : 0);

    const isHigher = deltaAmount > 0;

    const prevCatMap = {};
    previousReport.categoryBreakdown.forEach((c) => {
      prevCatMap[c.category] = c.amount;
    });

    const categoryDeltas = currentReport.categoryBreakdown.map((curr) => {
      const prevAmt = prevCatMap[curr.category] || 0;
      const diff = curr.amount - prevAmt;
      return {
        category: curr.category,
        current: curr.amount,
        previous: prevAmt,
        diff,
      };
    }).sort((a, b) => b.diff - a.diff);

    const topDriver = categoryDeltas.length > 0 ? categoryDeltas[0] : null;

    return {
      currentMonth,
      currentYear,
      previousMonth,
      previousYear,
      currentSpend,
      previousSpend,
      deltaAmount,
      percentageChange: Math.abs(parseFloat(percentageChange)),
      isHigher,
      categoryDeltas,
      topDriver,
    };
  }
}

