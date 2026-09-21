import prisma from '../../database/prisma.js';
import { BalanceService } from '../balance.service.js';
import { ReportingService } from '../reporting.service.js';
import { BudgetService } from '../budget.service.js';
import { ExpenseService } from '../expense.service.js';
import { VendorService } from '../vendor.service.js';
import { IncomeService } from '../income.service.js';
import { OrganizationService } from '../organization.service.js';
import { UserService } from '../user.service.js';
import { AuditService } from '../audit.service.js';
import { normalizeCategory, DEFAULT_CATEGORIES } from '../../validations/categories.js';
import { logger } from '../../utils/logger.js';

// In-memory 60-second confirmation tracker for destructive actions
const pendingResetConfirmations = new Map(); // userId -> timestamp

export class MultiEventProcessor {
  /**
   * Process multiple extracted financial events in an atomic, sequential manner
   *
   * @param {Object} params
   * @param {import('./intent.service.js').FinancialMessageSchema} params.financialMessage
   * @param {Object} params.user - Authenticated DB user
   * @param {string} params.rawMessage - Raw user text
   * @returns {Promise<Object>} Aggregated multi-event execution result
   */
  static async processEvents({ financialMessage, user, rawMessage }) {
    const events = financialMessage.events || [];
    logger.info(`Processing ${events.length} event(s) for user ID ${user.id} (${user.firstName})`);

    const mutationEvents = events.filter((e) => e.event_type === 'income' || e.event_type === 'expense');
    const queryEvents = events.filter(
      (e) =>
        e.event_type === 'balance_query' ||
        e.event_type === 'company_budget_query' ||
        e.event_type === 'monthly_expenses_query' ||
        e.event_type === 'monthly_income_query' ||
        e.event_type === 'employee_expenses_query' ||
        e.event_type === 'vendor_expenses_query' ||
        e.event_type === 'department_expenses_query' ||
        e.event_type === 'admin_count_query' ||
        e.event_type === 'employee_count_query' ||
        e.event_type === 'top_spender_query' ||
        e.event_type === 'top_department_query' ||
        e.event_type === 'financial_summary' ||
        e.event_type === 'cashflow_report' ||
        e.event_type === 'category_report' ||
        e.event_type === 'employee_report' ||
        e.event_type === 'budget_status' ||
        e.event_type === 'user_profile' ||
        e.event_type === 'role_elevation_request' ||
        e.event_type === 'search_transactions'
    );
    const actionEvents = events.filter(
      (e) =>
        e.event_type === 'edit_transaction' ||
        e.event_type === 'delete_transaction' ||
        e.event_type === 'set_budget' ||
        e.event_type === 'admin_reset_data' ||
        e.event_type === 'conversation_instruction' ||
        e.event_type === 'general_finance_question'
    );

    const recordedIncomes = [];
    const recordedExpenses = [];
    const lowConfidenceCategories = [];
    const queryResults = {};
    let requiresConfirmation = false;
    let resetExecuted = false;
    let confirmationWarning = null;
    let actionResult = null;

    // 1. Process Financial Mutations in an Atomic Database Transaction
    if (mutationEvents.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const ev of mutationEvents) {
          if (ev.event_type === 'income') {
            const amount = ev.amount;
            if (!amount || amount <= 0) continue;

            const source = ev.description || ev.source || 'General Revenue';
            const income = await tx.income.create({
              data: {
                userId: user.id,
                amount,
                source,
                description: ev.description || null,
                department: user.department || 'General',
              },
            });

            // Update cash balance if record exists
            const currentCash = await tx.cashBalance.findFirst();
            if (currentCash) {
              await tx.cashBalance.update({
                where: { id: currentCash.id },
                data: {
                  amount: currentCash.amount + amount,
                  updatedBy: user.id,
                },
              });
            }

            // Audit log
            await tx.auditLog.create({
              data: {
                actorId: user.id,
                action: 'INCOME_CREATED',
                target: `Income #${income.id}`,
                metadata: JSON.stringify({ amount, source }),
              },
            });

            recordedIncomes.push({
              id: income.id,
              amount: income.amount,
              source: income.source,
              description: income.description,
            });
          } else if (ev.event_type === 'expense') {
            const amount = ev.amount;
            if (!amount || amount <= 0) continue;

            let vendorId = null;
            if (ev.vendor) {
              const vendor = await VendorService.findOrCreateVendor(ev.vendor);
              if (vendor) vendorId = vendor.id;
            }

            const category = normalizeCategory(ev.category) || 'Misc';
            const note = ev.description || 'Expense';

            // Check category confidence
            const confidence = typeof ev.confidence === 'number' ? ev.confidence : 0.95;
            if (confidence < 0.7) {
              lowConfidenceCategories.push({
                item: note,
                assignedCategory: category,
                confidence,
              });
            }

            const expense = await tx.expense.create({
              data: {
                userId: user.id,
                amount,
                category,
                note,
                vendorId,
                department: user.department || 'General',
              },
            });

            // Audit log
            await tx.auditLog.create({
              data: {
                actorId: user.id,
                action: 'EXPENSE_CREATED',
                target: `Expense #${expense.id}`,
                metadata: JSON.stringify({ amount, category, note }),
              },
            });

            recordedExpenses.push({
              id: expense.id,
              amount: expense.amount,
              category: expense.category,
              note: expense.note,
              confidence,
            });
          }
        }
      });

      // Trigger automatic budget check if expenses were logged
      if (recordedExpenses.length > 0) {
        const monthlyReport = await ExpenseService.getMonthlyReport();
        await BudgetService.checkBudgetAlerts(monthlyReport.totalSpent).catch(() => {});
      }
    }

    // 2. Process Queries
    for (const q of queryEvents) {
      if (q.event_type === 'balance_query') {
        queryResults.balance = await BalanceService.calculateCurrentBalance();
      } else if (q.event_type === 'financial_summary') {
        const canViewExecutive = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'MANAGER';
        if (!canViewExecutive) {
          // Normal employees only get their own spending summary
          const monthly = await ExpenseService.getMonthlyReport();
          const ownExpenses = monthly.expenses.filter((e) => e.userId === user.id);
          const ownTotal = ownExpenses.reduce((sum, e) => sum + e.amount, 0);
          queryResults.ownSummary = {
            userOnly: true,
            userName: user.firstName,
            userRole: user.role,
            currency: 'INR',
            currencySymbol: '₹',
            totalSpent: ownTotal,
            totalSpentFormatted: `₹${ownTotal.toLocaleString('en-IN')}`,
            count: ownExpenses.length,
            expenses: ownExpenses.map((e) => ({
              id: e.id,
              amount: e.amount,
              amountFormatted: `₹${e.amount.toLocaleString('en-IN')}`,
              category: e.category,
              note: e.note,
              date: e.createdAt.toISOString().split('T')[0],
            })),
            message: 'As an Employee, you have access to your personal expenses. Company-wide founder dashboards and team spend rankings are restricted to Managers and Admins.',
          };
        } else {
          const tf = q.timeframe || 'month';
          if (tf === 'today') {
            queryResults.daily = await ExpenseService.getDailyReport();
          } else if (tf === 'week') {
            queryResults.weekly = await ReportingService.getWeeklyReport();
          } else {
            queryResults.summary = await ReportingService.getFounderDashboard();
          }
        }
      } else if (q.event_type === 'cashflow_report') {
        if (user.role === 'EMPLOYEE') {
          queryResults.error = 'Permission Denied: Company cashflow reports are restricted to Managers and Administrators.';
        } else {
          queryResults.cashflow = await IncomeService.getCashflowReport();
        }
      } else if (q.event_type === 'category_report') {
        queryResults.categories = await ExpenseService.getMonthlyReport();
      } else if (q.event_type === 'employee_report') {
        if (user.role === 'EMPLOYEE') {
          queryResults.error = 'Permission Denied: Team member spending rankings are only accessible to Managers and Administrators.';
        } else {
          queryResults.topSpenders = await ReportingService.getTopSpenders(5);
        }
      } else if (q.event_type === 'budget_status') {
        const [budget, monthly] = await Promise.all([
          BudgetService.getBudget(),
          ExpenseService.getMonthlyReport(),
        ]);
        const canUserSetBudget = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
        queryResults.budget = {
          hasBudget: !!budget,
          budgetAmount: budget ? budget.amount : null,
          spentAmount: monthly.totalSpent,
          percentageUsed: budget ? Math.min((monthly.totalSpent / budget.amount) * 100, 999) : null,
          canUserSetBudget,
          userRole: user.role,
          roleNotice: canUserSetBudget
            ? 'You have Admin privileges to set or update the monthly budget.'
            : `You are currently an Employee (${user.firstName || user.username || 'User'}). Only Admins and Super Admins have permission to set or modify company budgets.`,
        };
      } else if (q.event_type === 'user_profile') {
        const canSetBudget = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
        queryResults.profile = {
          name: user.firstName || 'Team Member',
          username: user.username,
          role: user.role,
          department: user.department || 'General',
          canSetBudget,
          canManageUsers: canSetBudget,
          canViewCompanyReports: user.role !== 'EMPLOYEE',
          roleDescription:
            user.role === 'EMPLOYEE'
              ? 'You are an Employee. You can log personal expenses, upload receipts, and check your spending history.'
              : user.role === 'MANAGER'
              ? 'You are a Manager. You can review department budgets and team analytics.'
              : 'You are an Administrator. You have full permissions to manage company budgets, users, and financial records.',
        };
      } else if (q.event_type === 'role_elevation_request') {
        const admins = await prisma.user.findMany({
          where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
          select: { firstName: true, username: true, role: true },
        });
        queryResults.roleElevation = {
          userRole: user.role,
          canSelfElevate: false,
          message: 'I cannot grant you admin rights. Only a Super Admin can promote team members using the /addadmin or /addmanager command.',
          admins: admins.map((a) => `${a.firstName || 'Admin'} (@${a.username || 'N/A'}) [${a.role}]`),
        };
      } else if (q.event_type === 'company_budget_query') {
        const [budget, monthly] = await Promise.all([
          BudgetService.getBudget(),
          ExpenseService.getMonthlyReport(),
        ]);
        const canUserSetBudget = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
        queryResults.companyBudget = {
          hasBudget: !!budget,
          budgetAmount: budget ? budget.amount : null,
          spentAmount: monthly.totalSpent,
          remainingBudget: budget ? budget.amount - monthly.totalSpent : null,
          percentageUsed: budget && budget.amount > 0 ? (monthly.totalSpent / budget.amount) * 100 : null,
          month: monthly.month,
          year: monthly.year,
          canUserSetBudget,
          userRole: user.role,
        };
      } else if (q.event_type === 'admin_count_query') {
        queryResults.adminCount = await OrganizationService.getAdminCount();
      } else if (q.event_type === 'employee_count_query') {
        queryResults.employeeCount = await OrganizationService.getEmployeeCount();
      } else if (q.event_type === 'top_spender_query') {
        queryResults.topSpender = await UserService.getTopSpender();
      } else if (q.event_type === 'top_department_query') {
        queryResults.topDepartment = await OrganizationService.getTopSpendingDepartment();
      } else if (q.event_type === 'monthly_expenses_query') {
        queryResults.monthlyExpenses = await ExpenseService.getMonthlyReport();
      } else if (q.event_type === 'monthly_income_query') {
        queryResults.monthlyIncome = await IncomeService.getMonthlyIncome();
      } else if (q.event_type === 'employee_expenses_query') {
        queryResults.employeeExpenses = await UserService.getEmployeeSpending(q.employee_name);
      } else if (q.event_type === 'department_expenses_query') {
        queryResults.departmentExpenses = await OrganizationService.getDepartmentExpenses(q.department);
      } else if (q.event_type === 'vendor_expenses_query') {
        queryResults.vendorExpenses = await VendorService.getVendorReport(q.vendor);
      } else if (q.event_type === 'search_transactions') {
        queryResults.search = await ExpenseService.searchExpenses({
          userId: user.id,
          userRole: user.role,
          keyword: q.keyword,
          category: q.category,
          days: q.days,
          minAmount: q.min_amount,
          maxAmount: q.max_amount,
        });
      }
    }

    // 3. Process Action & Admin Events
    for (const a of actionEvents) {
      if (a.event_type === 'admin_reset_data') {
        const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
        if (!isAdmin) {
          actionResult = {
            error: 'Unauthorized: Only administrators are permitted to reset company financial records.',
          };
          continue;
        }

        const hasPending = pendingResetConfirmations.has(user.id);
        const pendingTime = pendingResetConfirmations.get(user.id);
        const isExpired = pendingTime && Date.now() - pendingTime > 60000;

        const rawUpper = rawMessage.trim().toUpperCase();
        const isConfirmed = a.confirmed === true || rawUpper === 'CONFIRM RESET';

        if (isConfirmed && hasPending && !isExpired) {
          pendingResetConfirmations.delete(user.id);
          const resetStats = await BalanceService.resetAllFinancialData(user);
          resetExecuted = true;
          actionResult = {
            resetExecuted: true,
            message: 'All financial records have been permanently cleared. Balance is reset to ₹0.',
            ...resetStats,
          };
        } else {
          pendingResetConfirmations.set(user.id, Date.now());
          requiresConfirmation = true;
          confirmationWarning =
            'WARNING:\nThis action will permanently delete all financial records.\n\nReply exactly:\nCONFIRM RESET\n\nbefore execution.\n\nNo deletion will occur without this confirmation. This prompt expires in 60 seconds.';
        }
      } else if (a.event_type === 'delete_transaction') {
        const target = await ExpenseService.findRecentMatchingExpense({
          userId: user.id,
          query: a.search_query,
          category: a.category,
          date: a.date || 'today',
        });
        if (target) {
          await ExpenseService.softDeleteExpense(target.id, user);
          actionResult = {
            deleted: true,
            id: target.id,
            amount: target.amount,
            category: target.category,
            note: target.note,
          };
        } else {
          actionResult = { error: 'Could not find matching transaction to delete.' };
        }
      } else if (a.event_type === 'edit_transaction') {
        const target = await ExpenseService.findRecentMatchingExpense({
          userId: user.id,
          query: a.search_query,
        });
        if (target && a.new_value) {
          const updates = {};
          if (a.field === 'category') updates.category = normalizeCategory(String(a.new_value));
          else if (a.field === 'note') updates.note = String(a.new_value);
          else updates.amount = parseFloat(a.new_value);

          const updated = await ExpenseService.editExpense(target.id, user, updates);
          actionResult = { updated: true, id: updated.id, newAmount: updated.amount, note: updated.note };
        }
      } else if (a.event_type === 'set_budget') {
        const canSet = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
        if (!canSet) {
          actionResult = {
            error: `🚫 Permission Denied: You are currently an Employee (${user.firstName || user.username || 'User'}). Only Admins and Super Admins can set or modify the monthly budget. Please contact an Admin to configure the budget.`,
          };
        } else {
          if (!a.amount || a.amount <= 0) {
            actionResult = { error: 'Please provide a valid positive budget amount.' };
          } else {
            const updated = await BudgetService.setBudget(a.amount, user);
            actionResult = {
              budgetUpdated: true,
              amount: updated.amount,
              month: updated.month,
              year: updated.year,
            };
          }
        }
      } else if (a.event_type === 'general_finance_question') {
        actionResult = {
          generalQuestion: true,
          question: a.question || rawMessage,
          capabilities: [
            'Check current company balance ("What is our balance?")',
            'Record single expenses ("Spent 500 on petrol")',
            'Record multiple expenses at once ("Tea: 100, Lunch: 200, Petrol: 500")',
            'Record income and revenue ("Received 50000 from client")',
            'Monthly & weekly reports ("How much did we spend this month?")',
            'Budget tracking ("What is our budget status?")',
            'Track receipts and voice notes',
          ],
        };
      }
    }

    const totalInflow = recordedIncomes.reduce((sum, i) => sum + i.amount, 0);
    const totalOutflow = recordedExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netImpact = totalInflow - totalOutflow;

    return {
      isDeterministic: financialMessage.isDeterministic || false,
      hasMutations: recordedIncomes.length > 0 || recordedExpenses.length > 0,
      recordedIncomes,
      recordedExpenses,
      totalInflow,
      totalOutflow,
      netImpact,
      queryResults,
      lowConfidenceCategories,
      requiresConfirmation,
      resetExecuted,
      confirmationWarning,
      actionResult,
    };
  }
}
