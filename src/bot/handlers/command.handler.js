import { handleStart } from '../commands/start.command.js';
import { handleExpense } from '../commands/expense.command.js';
import { handleDaily } from '../commands/daily.command.js';
import { handleMonthly } from '../commands/monthly.command.js';
import { handleBudget, handleSetBudget } from '../commands/budget.command.js';
import { handleCategories } from '../commands/categories.command.js';
import { handleHelp } from '../commands/help.command.js';

import {
  handleAddAdmin,
  handleRemoveAdmin,
  handleAddManager,
  handleRemoveManager,
  handleListUsers,
  handleListPermissions,
  handleGrantPermission,
  handleRevokePermission,
} from '../commands/rbac.command.js';

import { handleAuditLogs } from '../commands/audit.command.js';
import { handleEditExpense, handleDeleteExpense } from '../commands/editDeleteExpense.command.js';
import { handleHistory } from '../commands/history.command.js';
import { handleSetDepartmentBudget, handleDepartmentBudget } from '../commands/departmentBudget.command.js';
import { handlePhotoUpload } from '../commands/receipt.command.js';
import { handleVendors, handleVendorDetails, handleVendorReport } from '../commands/vendor.command.js';
import {
  handleWeekly,
  handleTopSpenders,
  handleDepartmentReport,
  handleCategoryReport,
} from '../commands/advancedReports.command.js';

import {
  handleFounderDashboard,
  handleBurnRate,
  handleRunway,
  handleSetCash,
  handleForecast,
} from '../commands/founder.command.js';

import { handleRecurring } from '../commands/recurring.command.js';

import { requirePermission } from '../middleware/permission.middleware.js';
import { PERMISSIONS } from '../../services/permission.service.js';
import { handleConversationalMessage } from './conversation.handler.js';
import { handleVoiceMessage } from './voice.handler.js';

/**
 * Register all bot commands & update handlers
 * @param {import('telegraf').Telegraf} bot
 */
export const registerCommands = (bot) => {
  // Public & Employee Commands
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('expense', requirePermission(PERMISSIONS.ADD_EXPENSE), handleExpense);
  bot.command('history', requirePermission(PERMISSIONS.VIEW_OWN_EXPENSES), handleHistory);
  bot.command('daily', handleDaily);
  bot.command('monthly', handleMonthly);
  bot.command('categories', handleCategories);

  // Photo / Receipt OCR Listener
  bot.on('photo', requirePermission(PERMISSIONS.UPLOAD_RECEIPT), handlePhotoUpload);

  // Expense Edit & Soft Delete
  bot.command('editexpense', requirePermission(PERMISSIONS.EDIT_EXPENSE), handleEditExpense);
  bot.command('deleteexpense', requirePermission(PERMISSIONS.DELETE_EXPENSE), handleDeleteExpense);

  // Budget & Department Budgets
  bot.command('budget', handleBudget);
  bot.command('setbudget', requirePermission(PERMISSIONS.MANAGE_BUDGETS), handleSetBudget);
  bot.command('departmentbudget', handleDepartmentBudget);
  bot.command('setdepartmentbudget', requirePermission(PERMISSIONS.MANAGE_BUDGETS), handleSetDepartmentBudget);

  // Vendor Management & Reports
  bot.command('vendors', handleVendors);
  bot.command('vendor', handleVendorDetails);
  bot.command('vendorreport', handleVendorReport);

  // Advanced Reporting & Analytics
  bot.command('weekly', handleWeekly);
  bot.command('topspenders', handleTopSpenders);
  bot.command('leaderboard', handleTopSpenders);
  bot.command('department', handleDepartmentReport);
  bot.command('categoryreport', handleCategoryReport);

  // Founder Dashboard & Runway
  bot.command('founder', requirePermission(PERMISSIONS.VIEW_REPORTS), handleFounderDashboard);
  bot.command('burnrate', requirePermission(PERMISSIONS.VIEW_REPORTS), handleBurnRate);
  bot.command('runway', requirePermission(PERMISSIONS.VIEW_REPORTS), handleRunway);
  bot.command('forecast', requirePermission(PERMISSIONS.VIEW_REPORTS), handleForecast);
  bot.command('setcash', requirePermission(PERMISSIONS.MANAGE_CASH), handleSetCash);

  // Recurring Expenses
  bot.command('recurring', requirePermission(PERMISSIONS.MANAGE_RECURRING), handleRecurring);

  // RBAC & Administration Commands (Super Admin / Admin)
  bot.command('users', requirePermission(PERMISSIONS.MANAGE_USERS), handleListUsers);
  bot.command('addadmin', requirePermission(PERMISSIONS.MANAGE_USERS), handleAddAdmin);
  bot.command('removeadmin', requirePermission(PERMISSIONS.MANAGE_USERS), handleRemoveAdmin);
  bot.command('addmanager', requirePermission(PERMISSIONS.MANAGE_USERS), handleAddManager);
  bot.command('removemanager', requirePermission(PERMISSIONS.MANAGE_USERS), handleRemoveManager);
  bot.command('permissions', requirePermission(PERMISSIONS.MANAGE_PERMISSIONS), handleListPermissions);
  bot.command('grant', requirePermission(PERMISSIONS.MANAGE_PERMISSIONS), handleGrantPermission);
  bot.command('revoke', requirePermission(PERMISSIONS.MANAGE_PERMISSIONS), handleRevokePermission);
  bot.command('auditlogs', requirePermission(PERMISSIONS.VIEW_AUDIT_LOGS), handleAuditLogs);

  // AI Financial Employee - Conversational & Voice Listeners
  bot.on('voice', handleVoiceMessage);
  bot.on('text', handleConversationalMessage);
};
