import prisma from '../database/prisma.js';
import { logger } from '../utils/logger.js';

export class OrganizationService {
  /**
   * Get Admin count and details
   */
  static async getAdminCount() {
    try {
      const admins = await prisma.user.findMany({
        where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
        select: { id: true, firstName: true, username: true, role: true, department: true },
        orderBy: { role: 'asc' },
      });

      const superAdminCount = admins.filter((a) => a.role === 'SUPER_ADMIN').length;
      const adminCount = admins.filter((a) => a.role === 'ADMIN').length;

      return {
        totalAdmins: admins.length,
        superAdminCount,
        adminCount,
        admins: admins.map((a) => ({
          id: a.id,
          name: a.firstName || 'Unknown',
          username: a.username ? `@${a.username}` : 'N/A',
          role: a.role,
          department: a.department || 'General',
        })),
      };
    } catch (error) {
      logger.error('Error in getAdminCount:', error);
      throw error;
    }
  }

  /**
   * Get Employee count and organization breakdown
   */
  static async getEmployeeCount() {
    try {
      const [totalUsers, employees, managers, admins] = await Promise.all([
        prisma.user.count(),
        prisma.user.findMany({
          where: { role: 'EMPLOYEE' },
          select: { id: true, firstName: true, username: true, department: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where: { role: 'MANAGER' } }),
        prisma.user.count({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } } }),
      ]);

      return {
        totalEmployees: employees.length,
        totalUsers,
        breakdown: {
          employees: employees.length,
          managers,
          admins,
        },
        employees: employees.map((e) => ({
          id: e.id,
          name: e.firstName || 'Unknown',
          username: e.username ? `@${e.username}` : 'N/A',
          department: e.department || 'General',
        })),
      };
    } catch (error) {
      logger.error('Error in getEmployeeCount:', error);
      throw error;
    }
  }

  /**
   * Get Department Expenses breakdown or for a specific department
   */
  static async getDepartmentExpenses(targetDepartment = null, month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
    try {
      const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

      const where = {
        isDeleted: false,
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      };

      if (targetDepartment) {
        where.department = { contains: targetDepartment.trim() };
      }

      const expenses = await prisma.expense.findMany({
        where,
        select: { amount: true, department: true, category: true, note: true },
      });

      const deptMap = {};
      let totalSpent = 0;

      expenses.forEach((e) => {
        const d = e.department || 'General';
        if (!deptMap[d]) {
          deptMap[d] = { department: d, amount: 0, count: 0 };
        }
        deptMap[d].amount += e.amount;
        deptMap[d].count += 1;
        totalSpent += e.amount;
      });

      const departments = Object.values(deptMap)
        .map((item) => ({
          ...item,
          percentage: totalSpent > 0 ? ((item.amount / totalSpent) * 100).toFixed(1) : '0.0',
        }))
        .sort((a, b) => b.amount - a.amount);

      return {
        targetDepartment,
        month,
        year,
        totalSpent,
        departmentCount: departments.length,
        departments,
        matchedDepartment: targetDepartment ? departments[0] || null : null,
      };
    } catch (error) {
      logger.error('Error in getDepartmentExpenses:', error);
      throw error;
    }
  }

  /**
   * Identify which department spent the most
   */
  static async getTopSpendingDepartment(month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
    try {
      const report = await this.getDepartmentExpenses(null, month, year);

      if (report.departments.length === 0) {
        return {
          hasSpending: false,
          month,
          year,
          message: 'No department spending recorded for this month yet.',
        };
      }

      const topDept = report.departments[0];
      return {
        hasSpending: true,
        month,
        year,
        topDepartment: topDept.department,
        amount: topDept.amount,
        count: topDept.count,
        percentage: topDept.percentage,
        totalCompanySpend: report.totalSpent,
        allDepartments: report.departments,
      };
    } catch (error) {
      logger.error('Error in getTopSpendingDepartment:', error);
      throw error;
    }
  }
}
