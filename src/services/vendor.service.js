import prisma from '../database/prisma.js';
import { logger } from '../utils/logger.js';

export class VendorService {
  /**
   * Find existing vendor by name or create a new one
   */
  static async findOrCreateVendor(name) {
    if (!name) return null;
    const cleanName = name.trim();

    try {
      let vendor = await prisma.vendor.findFirst({
        where: { name: { equals: cleanName } },
      });

      if (!vendor) {
        vendor = await prisma.vendor.create({
          data: { name: cleanName },
        });
      }

      return vendor;
    } catch (error) {
      logger.error(`Error in findOrCreateVendor for ${name}:`, error);
      return null;
    }
  }

  /**
   * Get all registered vendors
   */
  static async getAllVendors() {
    return prisma.vendor.findMany({
      include: {
        _count: { select: { expenses: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get vendor spending summary for current month
   */
  static async getVendorReport(vendorName, month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const whereClause = {
      isDeleted: false,
      createdAt: { gte: startOfMonth, lte: endOfMonth },
    };

    if (vendorName) {
      const vendor = await prisma.vendor.findFirst({
        where: { name: { equals: vendorName.trim() } },
      });
      if (!vendor) {
        return {
          found: false,
          vendorName,
          month,
          year,
          totalSpent: 0,
          count: 0,
          vendorBreakdown: [],
          expenses: [],
        };
      }
      whereClause.vendorId = vendor.id;
    }

    const expenses = await prisma.expense.findMany({
      where: whereClause,
      include: { vendor: true, user: true },
      orderBy: { createdAt: 'desc' },
    });

    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const count = expenses.length;

    // Group by vendor
    const vendorMap = {};
    expenses.forEach((e) => {
      const vName = e.vendor?.name || 'Unassigned / Direct';
      if (!vendorMap[vName]) {
        vendorMap[vName] = { amount: 0, count: 0 };
      }
      vendorMap[vName].amount += e.amount;
      vendorMap[vName].count += 1;
    });

    return {
      month,
      year,
      totalSpent,
      count,
      vendorBreakdown: Object.entries(vendorMap).map(([name, data]) => ({
        name,
        amount: data.amount,
        count: data.count,
      })).sort((a, b) => b.amount - a.amount),
      expenses,
    };
  }
}
