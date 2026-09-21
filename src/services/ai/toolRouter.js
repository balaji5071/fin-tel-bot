import { ExpenseService } from '../expense.service.js';
import { IncomeService } from '../income.service.js';
import { ReportingService } from '../reporting.service.js';
import { BudgetService } from '../budget.service.js';
import { BalanceService } from '../balance.service.js';
import { normalizeCategory, DEFAULT_CATEGORIES } from '../../validations/categories.js';
import { logger } from '../../utils/logger.js';
import prisma from '../../database/prisma.js';

// In-memory 60-second confirmation tracker for destructive actions
const pendingResetConfirmations = new Map(); // userId -> timestamp

export class ToolRouter {
  /**
   * Dispatches an extracted intent to the corresponding backend domain service,
   * performs all authoritative calculations, and returns structured data.
   *
   * @param {Object} params
   * @param {import('./intent.service.js').IntentOutputSchema} params.intentResult
   * @param {Object} params.user - Authenticated user object from database
   * @param {string} params.rawMessage - User's original text message
   * @returns {Promise<Object>} Authoritative calculation result from backend
   */
  static async routeIntent({ intentResult, user, rawMessage }) {
    const { intent } = intentResult;

    logger.info(`Routing intent "${intent}" for user ID ${user.id} (${user.firstName})`);

    try {
      switch (intent) {
        // Phase 2: Authoritative Balance Engine
        case 'balance_query': {
          const balance = await BalanceService.calculateCurrentBalance();
          return balance;
        }

        // Phase 3: Destructive Action Protection & Confirmation Workflow
        case 'admin_reset_data': {
          const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
          if (!isAdmin) {
            return {
              error: 'Unauthorized: Only administrators are permitted to reset company financial records.',
            };
          }

          const hasPending = pendingResetConfirmations.has(user.id);
          const pendingTime = pendingResetConfirmations.get(user.id);
          const isExpired = pendingTime && Date.now() - pendingTime > 60000;

          const rawUpper = rawMessage.trim().toUpperCase();
          const isConfirmed = intentResult.confirmed === true || rawUpper === 'CONFIRM RESET';

          if (isConfirmed && hasPending && !isExpired) {
            pendingResetConfirmations.delete(user.id);
            const resetStats = await BalanceService.resetAllFinancialData(user);
            return {
              resetExecuted: true,
              message: 'All financial records have been permanently cleared. Balance is reset to ₹0.',
              ...resetStats,
            };
          }

          // Arm the 60-second destructive action barrier
          pendingResetConfirmations.set(user.id, Date.now());
          return {
            requiresConfirmation: true,
            warning:
              'WARNING:\nThis action will permanently delete all financial records.\n\nReply exactly:\nCONFIRM RESET\n\nbefore execution.\n\nNo deletion will occur without this confirmation. This prompt expires in 60 seconds.',
          };
        }

        case 'create_expense': {
          const amount = intentResult.amount;
          if (!amount || amount <= 0) {
            return { error: 'I could not determine the expense amount. Please specify an amount (e.g., "Spent 500 on petrol").' };
          }

          const category = normalizeCategory(intentResult.category) || 'Misc';
          const note = intentResult.description || 'Expense';
          const vendorName = intentResult.vendor || null;

          const expense = await ExpenseService.addExpense({
            userId: user.id,
            amount,
            category,
            note,
            vendorName,
            department: user.department || 'General',
          });

          return {
            id: expense.id,
            amount: expense.amount,
            category: expense.category,
            note: expense.note,
            vendor: expense.vendor ? expense.vendor.name : null,
            createdAt: expense.createdAt,
          };
        }

        case 'create_income': {
          const amount = intentResult.amount;
          if (!amount || amount <= 0) {
            return { error: 'Please provide a valid income amount.' };
          }

          const source = intentResult.source || 'General Revenue';
          const description = intentResult.description || intentResult.source || 'Income logged';

          const income = await IncomeService.addIncome({
            userId: user.id,
            amount,
            source,
            description,
            department: user.department || 'General',
          });

          return {
            id: income.id,
            amount: income.amount,
            source: income.source,
            description: income.description,
          };
        }

        case 'bulk_expense_entry': {
          const rawTransactions = intentResult.transactions;
          if (!rawTransactions || rawTransactions.length === 0) {
            return { error: 'No individual expenses could be identified from your input.' };
          }

          const normalizedTransactions = rawTransactions.map((tx) => ({
            amount: tx.amount,
            category: normalizeCategory(tx.category) || 'Misc',
            description: tx.description || 'Expense',
            vendor: tx.vendor || null,
            date: tx.date || 'today',
          }));

          const result = await ExpenseService.addBulkExpenses({
            userId: user.id,
            transactions: normalizedTransactions,
            department: user.department || 'General',
          });

          return {
            count: result.count,
            total: result.total,
            items: result.expenses.map((e) => ({
              id: e.id,
              amount: e.amount,
              category: e.category,
              note: e.note,
            })),
          };
        }

        case 'edit_transaction':
        case 'edit_expense': {
          const targetId = intentResult.transaction_id || intentResult.expense_id;
          let targetExpense = null;

          if (targetId) {
            targetExpense = await prisma.expense.findUnique({
              where: { id: targetId },
            });
          } else {
            targetExpense = await ExpenseService.findRecentMatchingExpense({
              userId: user.id,
              query: intentResult.search_query,
              category: intentResult.category,
              amount: intentResult.amount,
            });
          }

          if (!targetExpense || targetExpense.isDeleted) {
            return { error: 'I could not find a matching recent transaction to edit. Could you specify the transaction ID or describe it more specifically?' };
          }

          const updates = {};
          const field = intentResult.field || 'amount';

          if (field === 'amount' && intentResult.new_value) {
            const parsedAmt = parseFloat(intentResult.new_value);
            if (!isNaN(parsedAmt) && parsedAmt > 0) updates.amount = parsedAmt;
          } else if (field === 'category' && intentResult.new_value) {
            updates.category = normalizeCategory(String(intentResult.new_value));
          } else if (field === 'note' && intentResult.new_value) {
            updates.note = String(intentResult.new_value);
          } else if (intentResult.amount) {
            updates.amount = intentResult.amount;
          }

          if (Object.keys(updates).length === 0) {
            return { error: 'Please specify the new value you would like to set.' };
          }

          const updated = await ExpenseService.editExpense(targetExpense.id, user, updates);

          return {
            id: updated.id,
            previousAmount: targetExpense.amount,
            amount: updated.amount,
            category: updated.category,
            note: updated.note,
            field,
            newValue: intentResult.new_value || updates.amount,
          };
        }

        case 'delete_transaction':
        case 'delete_expense': {
          const targetId = intentResult.transaction_id || intentResult.expense_id;
          let targetExpense = null;

          if (targetId) {
            targetExpense = await prisma.expense.findUnique({
              where: { id: targetId },
            });
          } else {
            targetExpense = await ExpenseService.findRecentMatchingExpense({
              userId: user.id,
              query: intentResult.search_query,
              category: intentResult.category,
              date: intentResult.date || 'today',
            });
          }

          if (!targetExpense || targetExpense.isDeleted) {
            return { error: 'I could not find the transaction you want to delete. Could you specify the transaction ID or what it was for?' };
          }

          await ExpenseService.softDeleteExpense(targetExpense.id, user);

          return {
            id: targetExpense.id,
            amount: targetExpense.amount,
            category: targetExpense.category,
            note: targetExpense.note,
            deleted: true,
          };
        }

        case 'search_transactions':
        case 'search_expenses': {
          const results = await ExpenseService.searchExpenses({
            userId: user.id,
            userRole: user.role,
            keyword: intentResult.keyword,
            category: intentResult.category,
            vendor: intentResult.vendor,
            days: intentResult.days,
            minAmount: intentResult.min_amount,
            maxAmount: intentResult.max_amount,
            limit: 8,
          });

          return {
            count: results.count,
            totalSpent: results.totalSpent,
            expenses: results.expenses.map((e) => ({
              id: e.id,
              amount: e.amount,
              category: e.category,
              note: e.note,
              date: e.createdAt.toISOString().split('T')[0],
              loggedBy: e.user ? e.user.firstName : 'Unknown',
            })),
          };
        }

        case 'financial_summary': {
          const tf = intentResult.timeframe || 'month';
          if (tf === 'today') {
            const report = await ExpenseService.getDailyReport();
            return {
              timeframe: 'today',
              totalSpent: report.totalSpent,
              count: report.count,
              categoryBreakdown: report.categoryBreakdown,
            };
          } else if (tf === 'week') {
            const report = await ReportingService.getWeeklyReport();
            return {
              timeframe: 'week',
              totalSpent: report.totalSpent,
              count: report.count,
              categoryBreakdown: report.categoryBreakdown,
            };
          }

          const dashboard = await ReportingService.getFounderDashboard();
          return {
            timeframe: 'overview',
            yesterdaySpend: dashboard.yesterdaySpend,
            weeklySpend: dashboard.weeklySpend,
            monthlySpend: dashboard.monthlySpend,
            projectedSpend: dashboard.projectedSpend,
            cashBalance: dashboard.cashBalance,
            runwayMonths: dashboard.runwayMonths,
            topSpenders: dashboard.topSpenders,
          };
        }

        case 'cashflow_report': {
          const cashflow = await IncomeService.getCashflowReport();
          return {
            month: cashflow.month,
            year: cashflow.year,
            inflow: cashflow.totalInflow,
            outflow: cashflow.totalOutflow,
            netCashflow: cashflow.netCashflow,
            isPositive: cashflow.isPositive,
            currentBankCash: cashflow.currentBankCash,
          };
        }

        case 'category_report': {
          const month = intentResult.month || new Date().getMonth() + 1;
          const year = intentResult.year || new Date().getFullYear();
          const report = await ExpenseService.getMonthlyReport(month, year);

          if (intentResult.category) {
            const targetCat = normalizeCategory(intentResult.category);
            const found = report.categoryBreakdown.find(
              (c) => c.category.toLowerCase() === targetCat.toLowerCase()
            );

            return {
              category: targetCat,
              amount: found ? found.amount : 0,
              count: found ? found.count : 0,
              totalMonthlySpend: report.totalSpent,
              percentage: found && report.totalSpent > 0 ? ((found.amount / report.totalSpent) * 100).toFixed(1) : 0,
            };
          }

          return {
            totalSpent: report.totalSpent,
            categoryBreakdown: report.categoryBreakdown,
          };
        }

        case 'employee_report': {
          const topSpenders = await ReportingService.getTopSpenders(5);
          return {
            spenders: topSpenders,
            count: topSpenders.length,
          };
        }

        case 'budget_status': {
          const budgetRecord = await BudgetService.getBudget();
          const monthlyReport = await ExpenseService.getMonthlyReport();

          if (!budgetRecord) {
            return {
              hasBudget: false,
              totalSpent: monthlyReport.totalSpent,
              message: 'No company budget has been set for this month yet.',
            };
          }

          const budgetAmount = budgetRecord.amount;
          const spentAmount = monthlyReport.totalSpent;
          const remainingAmount = budgetAmount - spentAmount;
          const percentageUsed = Math.min((spentAmount / budgetAmount) * 100, 999.9);
          const isOverBudget = remainingAmount < 0;

          return {
            hasBudget: true,
            budgetAmount,
            spentAmount,
            remainingAmount,
            percentageUsed,
            isOverBudget,
          };
        }

        case 'conversation_instruction': {
          return {
            instructionAcknowledged: true,
            message: 'Understood. I have updated my conversational preferences for our session.',
          };
        }

        case 'general_finance_question':
        default: {
          return {
            question: intentResult.question || rawMessage,
            supportedCategories: DEFAULT_CATEGORIES,
            capabilities: [
              'Check balance ("What is our balance?", "Current balance?")',
              'Record single expenses ("Spent 500 on petrol")',
              'Record bulk expenses ("Tea: 100, Lunch: 200, Petrol: 500")',
              'Track income ("Received 50000 from client")',
              'Real-time spending reports ("How much did we spend this month?")',
              'Budget tracking ("What is our budget status?")',
              'Cashflow & Runway ("Show cashflow overview")',
            ],
          };
        }
      }
    } catch (error) {
      logger.error(`Error in ToolRouter for intent ${intent}:`, error);
      return { error: error.message };
    }
  }
}
