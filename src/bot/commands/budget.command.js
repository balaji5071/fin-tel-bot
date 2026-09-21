import { BudgetService } from '../../services/budget.service.js';
import { ExpenseService } from '../../services/expense.service.js';
import { parseBudgetCommand } from '../../validations/budget.validation.js';
import { logger } from '../../utils/logger.js';

/**
 * Generate a clean text-based progress bar
 */
const generateProgressBar = (percent) => {
  const totalBlocks = 10;
  const filledBlocks = Math.min(Math.round((percent / 100) * totalBlocks), totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;
  const filledChar = '█';
  const emptyChar = '░';
  return `[${filledChar.repeat(filledBlocks)}${emptyChar.repeat(emptyBlocks)}]`;
};

export const handleBudget = async (ctx) => {
  try {
    const budgetRecord = await BudgetService.getBudget();
    const monthlyReport = await ExpenseService.getMonthlyReport();

    const monthName = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

    if (!budgetRecord) {
      const spentStr = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
      }).format(monthlyReport.totalSpent);

      return ctx.reply(
        `💳 *Monthly Budget Status (${monthName})*\n\n` +
          `⚠️ *No budget configured for this month.* \n` +
          `💰 *Total Spent So Far:* ${spentStr}\n\n` +
          `💡 _Admins can set a budget using:_ \`/setbudget <amount>\``,
        { parse_mode: 'Markdown' }
      );
    }

    const budgetAmount = budgetRecord.amount;
    const spentAmount = monthlyReport.totalSpent;
    const remainingAmount = budgetAmount - spentAmount;
    const percentageUsed = Math.min(((spentAmount / budgetAmount) * 100), 999.9);

    const fmtBudget = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(budgetAmount);
    const fmtSpent = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(spentAmount);
    const fmtRemaining = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
      Math.abs(remainingAmount)
    );

    const progressBar = generateProgressBar(percentageUsed);
    const isOverBudget = remainingAmount < 0;

    let message = `💳 *Monthly Budget Overview (${monthName})*\n\n`;
    message += `🎯 *Budget Target:* ${fmtBudget}\n`;
    message += `💸 *Total Spent:* ${fmtSpent}\n`;
    message += `${isOverBudget ? '🔴 *Over Budget By:*' : '🟢 *Remaining Balance:*'} ${fmtRemaining}\n`;
    message += `📊 *Usage:* ${percentageUsed.toFixed(1)}%\n`;
    message += `\`${progressBar}\`\n\n`;

    if (isOverBudget) {
      message += `⚠️ *Alert:* Spending has exceeded the allocated monthly budget!`;
    } else if (percentageUsed >= 85) {
      message += `⚡ *Notice:* You have utilized over 85% of your monthly budget.`;
    } else {
      message += `✅ *Status:* Spending is within budget limits.`;
    }

    return ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error('Error fetching budget details:', error);
    return ctx.reply('⚠️ Failed to load budget information.');
  }
};

export const handleSetBudget = async (ctx) => {
  try {
    const text = ctx.message?.text || '';
    const parsed = parseBudgetCommand(text);

    const updatedBudget = await BudgetService.setBudget(parsed.amount);

    const monthName = new Date(updatedBudget.year, updatedBudget.month - 1, 1).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    const fmtAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(updatedBudget.amount);

    const message =
      `🎉 *Monthly Budget Updated!*\n\n` +
      `📅 *Period:* ${monthName}\n` +
      `💰 *New Monthly Budget:* ${fmtAmount}\n\n` +
      `Use \`/budget\` anytime to check budget progress.`;

    return ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.warn(`Invalid /setbudget command input: ${error.message}`);
    return ctx.reply(`⚠️ ${error.message}`, { parse_mode: 'Markdown' });
  }
};
