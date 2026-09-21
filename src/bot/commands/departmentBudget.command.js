import { BudgetService } from '../../services/budget.service.js';
import { escapeMd } from '../../utils/markdown.js';

export const handleSetDepartmentBudget = async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length < 3) {
    return ctx.reply('⚠️ Usage: `/setdepartmentbudget <Department> <Amount>`\nExample: `/setdepartmentbudget Marketing 50000`', {
      parse_mode: 'Markdown',
    });
  }

  const department = parts[1];
  const amount = parseFloat(parts[2]);

  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('⚠️ Budget amount must be a positive number.');
  }

  try {
    const updated = await BudgetService.setDepartmentBudget(department, amount, ctx.state.user);
    const monthName = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const fmtAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(updated.amount);

    return ctx.reply(
      `🎯 *Department Budget Set!*\n\n` +
        `🏢 *Department:* ${escapeMd(updated.department)}\n` +
        `💰 *Budget:* ${fmtAmount}\n` +
        `📅 *Period:* ${monthName}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    return ctx.reply(`⚠️ ${error.message}`);
  }
};

export const handleDepartmentBudget = async (ctx) => {
  try {
    const budgets = await BudgetService.getAllDepartmentBudgets();
    const monthName = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

    if (budgets.length === 0) {
      return ctx.reply(`🏢 _No department budgets set for ${monthName} yet._`, { parse_mode: 'Markdown' });
    }

    let msg = `🏢 *Department Budgets Overview (${monthName}):*\n\n`;
    budgets.forEach((b) => {
      const fmtAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(b.amount);
      msg += `• *${escapeMd(b.department)}:* ${fmtAmount}\n`;
    });

    return ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (error) {
    return ctx.reply('⚠️ Failed to load department budget data.');
  }
};
