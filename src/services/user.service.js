import prisma from '../database/prisma.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AuditService } from './audit.service.js';

export class UserService {
  /**
   * Find or create user, bootstrapping SUPER_ADMIN and ADMIN roles based on env config
   * @param {Object} telegramUser - Telegram user context (ctx.from)
   */
  static async findOrCreateUser(telegramUser) {
    if (!telegramUser || !telegramUser.id) {
      throw new Error('Telegram user object is invalid');
    }

    const telegramId = BigInt(telegramUser.id);
    const telegramIdStr = telegramUser.id.toString();
    const username = telegramUser.username || null;
    const firstName = telegramUser.first_name || 'Anonymous';

    let initialRole = 'EMPLOYEE';
    if (config.SUPER_ADMIN_IDS.includes(telegramIdStr)) {
      initialRole = 'SUPER_ADMIN';
    } else if (config.ADMIN_IDS.includes(telegramIdStr)) {
      initialRole = 'ADMIN';
    }

    try {
      const existingUser = await prisma.user.findUnique({
        where: { telegramId },
      });

      if (existingUser) {
        // Upgrade role if env variable designates SUPER_ADMIN or ADMIN and user is currently lower
        let updatedRole = existingUser.role;
        if (config.SUPER_ADMIN_IDS.includes(telegramIdStr) && existingUser.role !== 'SUPER_ADMIN') {
          updatedRole = 'SUPER_ADMIN';
        } else if (config.ADMIN_IDS.includes(telegramIdStr) && existingUser.role === 'EMPLOYEE') {
          updatedRole = 'ADMIN';
        }

        return await prisma.user.update({
          where: { telegramId },
          data: {
            username,
            firstName,
            role: updatedRole,
          },
        });
      }

      const newUser = await prisma.user.create({
        data: {
          telegramId,
          username,
          firstName,
          role: initialRole,
        },
      });

      logger.info(`Registered new user ${firstName} (@${username || 'N/A'}) with role ${initialRole}`);
      return newUser;
    } catch (error) {
      logger.error(`Error in findOrCreateUser for telegramId ${telegramUser.id}:`, error);
      throw error;
    }
  }

  /**
   * Find user by username or Telegram ID string
   */
  static async findUserByIdentifier(identifier) {
    const cleanInput = identifier.replace('@', '').trim();
    const numericId = parseInt(cleanInput, 10);

    if (!isNaN(numericId)) {
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(numericId) },
      });
      if (user) return user;
    }

    return prisma.user.findFirst({
      where: { username: { equals: cleanInput } },
    });
  }

  /**
   * Update role of a user
   */
  static async updateUserRole(actorUser, targetIdentifier, newRole) {
    const targetUser = await this.findUserByIdentifier(targetIdentifier);
    if (!targetUser) {
      throw new Error(`User "${targetIdentifier}" not found. Ensure they have started the bot.`);
    }

    const updated = await prisma.user.update({
      where: { id: targetUser.id },
      data: { role: newRole },
    });

    const isPromotion = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(newRole);
    await AuditService.log({
      actorId: actorUser.id,
      action: isPromotion ? 'USER_PROMOTED' : 'USER_DEMOTED',
      target: targetUser.username || targetUser.telegramId.toString(),
      metadata: { newRole, previousRole: targetUser.role },
    });

    return updated;
  }

  /**
   * Grant custom permission to user
   */
  static async grantPermission(actorUser, targetIdentifier, permission) {
    const targetUser = await this.findUserByIdentifier(targetIdentifier);
    if (!targetUser) {
      throw new Error(`User "${targetIdentifier}" not found.`);
    }

    let permissions = [];
    if (targetUser.customPermissions) {
      try {
        permissions = JSON.parse(targetUser.customPermissions);
      } catch (e) {
        permissions = [];
      }
    }

    if (!permissions.includes(permission)) {
      permissions.push(permission);
    }

    const updated = await prisma.user.update({
      where: { id: targetUser.id },
      data: { customPermissions: JSON.stringify(permissions) },
    });

    await AuditService.log({
      actorId: actorUser.id,
      action: 'PERMISSION_CHANGED',
      target: targetUser.username || targetUser.telegramId.toString(),
      metadata: { granted: permission },
    });

    return updated;
  }

  /**
   * Revoke custom permission from user
   */
  static async revokePermission(actorUser, targetIdentifier, permission) {
    const targetUser = await this.findUserByIdentifier(targetIdentifier);
    if (!targetUser) {
      throw new Error(`User "${targetIdentifier}" not found.`);
    }

    let permissions = [];
    if (targetUser.customPermissions) {
      try {
        permissions = JSON.parse(targetUser.customPermissions);
      } catch (e) {
        permissions = [];
      }
    }

    permissions = permissions.filter((p) => p !== permission);

    const updated = await prisma.user.update({
      where: { id: targetUser.id },
      data: { customPermissions: JSON.stringify(permissions) },
    });

    await AuditService.log({
      actorId: actorUser.id,
      action: 'PERMISSION_CHANGED',
      target: targetUser.username || targetUser.telegramId.toString(),
      metadata: { revoked: permission },
    });

    return updated;
  }

  /**
   * Fetch all users
   */
  static async getAllUsers() {
    return prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get spending analytics for an employee by name or identifier
   */
  static async getEmployeeSpending(nameOrIdentifier, month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
    try {
      const cleanInput = (nameOrIdentifier || '').replace('@', '').trim().toLowerCase();
      const allUsers = await prisma.user.findMany();

      const matchedUser = allUsers.find((u) => {
        const fn = (u.firstName || '').toLowerCase();
        const un = (u.username || '').toLowerCase();
        return fn === cleanInput || un === cleanInput || fn.includes(cleanInput) || un.includes(cleanInput);
      });

      if (!matchedUser) {
        return {
          found: false,
          targetName: nameOrIdentifier,
          month,
          year,
          totalSpent: 0,
          count: 0,
          categoryBreakdown: [],
          availableUsers: allUsers.map((u) => ({
            name: u.firstName || 'Anonymous',
            username: u.username ? `@${u.username}` : 'N/A',
            role: u.role,
          })),
        };
      }

      const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

      const expenses = await prisma.expense.findMany({
        where: {
          userId: matchedUser.id,
          isDeleted: false,
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        orderBy: { createdAt: 'desc' },
      });

      const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
      const categoriesMap = {};
      expenses.forEach((e) => {
        categoriesMap[e.category] = (categoriesMap[e.category] || 0) + e.amount;
      });

      const categoryBreakdown = Object.entries(categoriesMap)
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: totalSpent > 0 ? ((amount / totalSpent) * 100).toFixed(1) : '0.0',
        }))
        .sort((a, b) => b.amount - a.amount);

      return {
        found: true,
        user: {
          id: matchedUser.id,
          name: matchedUser.firstName || 'Anonymous',
          username: matchedUser.username ? `@${matchedUser.username}` : 'N/A',
          role: matchedUser.role,
          department: matchedUser.department || 'General',
        },
        month,
        year,
        totalSpent,
        count: expenses.length,
        categoryBreakdown,
        expenses: expenses.slice(0, 5),
      };
    } catch (error) {
      logger.error(`Error in getEmployeeSpending for "${nameOrIdentifier}":`, error);
      throw error;
    }
  }

  /**
   * Identify who spent the most this month and generate spending leaderboard
   */
  static async getTopSpender(month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
    try {
      const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

      const expenses = await prisma.expense.findMany({
        where: {
          isDeleted: false,
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        include: { user: true },
      });

      const userMap = {};
      let totalCompanySpend = 0;

      expenses.forEach((e) => {
        totalCompanySpend += e.amount;
        if (!userMap[e.userId]) {
          userMap[e.userId] = {
            user: {
              id: e.user.id,
              name: e.user.firstName || 'Unknown',
              username: e.user.username ? `@${e.user.username}` : 'N/A',
              role: e.user.role,
              department: e.user.department || 'General',
            },
            totalSpent: 0,
            count: 0,
            categories: {},
          };
        }
        userMap[e.userId].totalSpent += e.amount;
        userMap[e.userId].count += 1;
        userMap[e.userId].categories[e.category] = (userMap[e.userId].categories[e.category] || 0) + e.amount;
      });

      const spenders = Object.values(userMap)
        .map((s) => {
          const topCatEntry = Object.entries(s.categories).sort((a, b) => b[1] - a[1])[0];
          return {
            ...s,
            topCategory: topCatEntry ? { category: topCatEntry[0], amount: topCatEntry[1] } : null,
            percentage: totalCompanySpend > 0 ? ((s.totalSpent / totalCompanySpend) * 100).toFixed(1) : '0.0',
          };
        })
        .sort((a, b) => b.totalSpent - a.totalSpent);

      if (spenders.length === 0) {
        return {
          hasSpender: false,
          month,
          year,
          totalCompanySpend: 0,
          message: 'No expenses recorded for this month yet.',
        };
      }

      return {
        hasSpender: true,
        month,
        year,
        topSpender: spenders[0],
        allSpenders: spenders,
        totalCompanySpend,
      };
    } catch (error) {
      logger.error('Error in getTopSpender:', error);
      throw error;
    }
  }
}
