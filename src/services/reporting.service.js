import prisma from '../database/prisma.js';
import { logger } from '../utils/logger.js';
import { AuditService } from './audit.service.js';

export class ReportingService {
  /**
   * Set company cash balance for Runway calculation
   */
  static async setCashBalance(amount, actorUser) {
    try {
      const existing = await prisma.cashBalance.findFirst();
      let record;
      if (existing) {
        record = await prisma.cashBalance.update({
          where: { id: existing.id },
          data: { amount, updatedBy: actorUser.id },
        });
      } else {
        record = await prisma.cashBalance.create({
          data: { amount, updatedBy: actorUser.id },
        });
      }

      await AuditService.log({
        actorId: actorUser.id,
        action: 'CASH_BALANCE_UPDATED',
        target: 'Company Cash Balance',
        metadata: { amount },
      });

      return record;
    } catch (error) {
      logger.error('Error setting cash balance:', error);
      throw error;
    }
  }

  /**
   * Get Cash Balance
   */
  static async getCashBalance() {
    return prisma.cashBalance.findFirst();
  }

  /**
   * Weekly Report
   */
  static async getWeeklyReport() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    const expenses = await prisma.expense.findMany({
      where: {
        isDeleted: false,
        createdAt: { gte: startOfWeek },
      },
      include: { user: true, vendor: true },
      orderBy: { createdAt: 'desc' },
    });

    const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);

    const categoryMap = {};
    expenses.forEach((e) => {
      categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
    });

    return {
      totalSpent,
      count: expenses.length,
      categoryBreakdown: Object.entries(categoryMap)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      expenses,
    };
  }

  /**
   * Top Spenders / Leaderboard
   */
  static async getTopSpenders(limit = 5) {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const expenses = await prisma.expense.findMany({
      where: {
        isDeleted: false,
        createdAt: { gte: startOfMonth },
      },
      include: { user: true },
    });

    const userMap = {};
    expenses.forEach((e) => {
      const uName = e.user.firstName + (e.user.username ? ` (@${e.user.username})` : '');
      if (!userMap[uName]) {
        userMap[uName] = { name: uName, amount: 0, count: 0 };
      }
      userMap[uName].amount += e.amount;
      userMap[uName].count += 1;
    });

    return Object.values(userMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);
  }

  /**
   * Department Spending Report
   */
  static async getDepartmentReport() {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const expenses = await prisma.expense.findMany({
      where: {
        isDeleted: false,
        createdAt: { gte: startOfMonth },
      },
    });

    const deptMap = {};
    expenses.forEach((e) => {
      const dept = e.department || 'General';
      deptMap[dept] = (deptMap[dept] || 0) + e.amount;
    });

    return Object.entries(deptMap)
      .map(([department, amount]) => ({ department, amount }))
      .sort((a, b) => b.amount - a.amount);
  }

  /**
   * Calculate Month-End Forecast
   */
  static async calculateForecast() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const startOfMonth = new Date(year, month, 1);
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const daysPassed = Math.max(now.getDate(), 1);

    const expenses = await prisma.expense.findMany({
      where: {
        isDeleted: false,
        createdAt: { gte: startOfMonth },
      },
    });

    const currentMonthSpend = expenses.reduce((s, e) => s + e.amount, 0);
    const avgDailySpend = currentMonthSpend / daysPassed;
    const projectedSpend = avgDailySpend * totalDaysInMonth;

    return {
      currentMonthSpend,
      daysPassed,
      totalDaysInMonth,
      avgDailySpend,
      projectedSpend,
    };
  }

  /**
   * Calculate Runway
   */
  static async calculateRunway() {
    const cashRecord = await this.getCashBalance();
    const cash = cashRecord ? cashRecord.amount : 0;

    // Calculate last 3 months average burn
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const expenses = await prisma.expense.findMany({
      where: {
        isDeleted: false,
        createdAt: { gte: threeMonthsAgo },
      },
    });

    const totalBurn3Months = expenses.reduce((s, e) => s + e.amount, 0);
    const avgMonthlyBurn = totalBurn3Months / 3 || 1; // avoid divide by zero

    const runwayMonths = cash > 0 ? (cash / avgMonthlyBurn).toFixed(1) : 0;

    return {
      cashBalance: cash,
      avgMonthlyBurn,
      runwayMonths,
    };
  }

  /**
   * Comprehensive Founder Dashboard Overview
   */
  static async getFounderDashboard() {
    const now = new Date();

    // Yesterday spend
    const yesterdayStart = new Date(now);
    yesterdayStart.setDate(now.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(now);
    yesterdayEnd.setDate(now.getDate() - 1);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const yesterdayExpenses = await prisma.expense.findMany({
      where: { isDeleted: false, createdAt: { gte: yesterdayStart, lte: yesterdayEnd } },
    });
    const yesterdaySpend = yesterdayExpenses.reduce((s, e) => s + e.amount, 0);

    const weekly = await this.getWeeklyReport();
    const topSpenders = await this.getTopSpenders(3);
    const forecast = await this.calculateForecast();
    const runway = await this.calculateRunway();

    return {
      yesterdaySpend,
      weeklySpend: weekly.totalSpent,
      monthlySpend: forecast.currentMonthSpend,
      projectedSpend: forecast.projectedSpend,
      cashBalance: runway.cashBalance,
      runwayMonths: runway.runwayMonths,
      topSpenders,
    };
  }
}
