import prisma from '../database/prisma.js';
import { logger } from '../utils/logger.js';
import { NotificationService } from './notification.service.js';
import { AuditService } from './audit.service.js';

export class BudgetService {
  /**
   * Set or update monthly company budget
   */
  static async setBudget(amount, actorUser, month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
    try {
      const budget = await prisma.budget.upsert({
        where: { month_year: { month, year } },
        update: { amount },
        create: { month, year, amount },
      });

      await AuditService.log({
        actorId: actorUser.id,
        action: 'BUDGET_CHANGED',
        target: `Company Budget ${month}/${year}`,
        metadata: { amount },
      });

      return budget;
    } catch (error) {
      logger.error(`Error setting budget for ${month}/${year}:`, error);
      throw error;
    }
  }

  /**
   * Set or update department budget
   */
  static async setDepartmentBudget(department, amount, actorUser, month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
    try {
      const deptBudget = await prisma.departmentBudget.upsert({
        where: { department_month_year: { department, month, year } },
        update: { amount },
        create: { department, month, year, amount },
      });

      await AuditService.log({
        actorId: actorUser.id,
        action: 'BUDGET_CHANGED',
        target: `Department Budget ${department} ${month}/${year}`,
        metadata: { department, amount },
      });

      return deptBudget;
    } catch (error) {
      logger.error(`Error setting department budget for ${department}:`, error);
      throw error;
    }
  }

  /**
   * Get company budget
   */
  static async getBudget(month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
    return prisma.budget.findUnique({
      where: { month_year: { month, year } },
    });
  }

  /**
   * Get department budget
   */
  static async getDepartmentBudget(department, month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
    return prisma.departmentBudget.findUnique({
      where: { department_month_year: { department, month, year } },
    });
  }

  /**
   * Get all department budgets for a month
   */
  static async getAllDepartmentBudgets(month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
    return prisma.departmentBudget.findMany({
      where: { month, year },
    });
  }

  /**
   * Check monthly budget thresholds and send automated alert notifications (50%, 75%, 90%, 100%)
   */
  static async checkBudgetAlerts(totalSpent, month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
    const budgetRecord = await this.getBudget(month, year);
    if (!budgetRecord || budgetRecord.amount <= 0) return;

    const budget = budgetRecord.amount;
    const usagePercent = (totalSpent / budget) * 100;

    let alertThreshold = null;
    let updateField = null;

    if (usagePercent >= 100 && !budgetRecord.alert100Sent) {
      alertThreshold = 100;
      updateField = { alert100Sent: true };
    } else if (usagePercent >= 90 && !budgetRecord.alert90Sent) {
      alertThreshold = 90;
      updateField = { alert90Sent: true };
    } else if (usagePercent >= 75 && !budgetRecord.alert75Sent) {
      alertThreshold = 75;
      updateField = { alert75Sent: true };
    } else if (usagePercent >= 50 && !budgetRecord.alert50Sent) {
      alertThreshold = 50;
      updateField = { alert50Sent: true };
    }

    if (alertThreshold && updateField) {
      // Mark alert sent in DB
      await prisma.budget.update({
        where: { id: budgetRecord.id },
        data: updateField,
      });

      const formattedBudget = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(budget);
      const formattedSpent = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalSpent);

      const alertMessage =
        `⚠️ *Budget Alert (${alertThreshold}% Threshold Exceeded!)*\n\n` +
        `💰 *Monthly Budget:* ${formattedBudget}\n` +
        `💸 *Total Spent:* ${formattedSpent}\n` +
        `📊 *Budget Usage:* ${usagePercent.toFixed(1)}%\n\n` +
        `Please review recent expenses to keep spending under control.`;

      // Broadcast alert to Admins, Managers, and Super Admins
      await NotificationService.broadcastToRoles(['SUPER_ADMIN', 'ADMIN', 'MANAGER'], 'BUDGET_ALERT', alertMessage);
    }
  }
}
