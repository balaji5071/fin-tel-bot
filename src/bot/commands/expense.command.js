import { parseExpenseCommand } from '../../validations/expense.validation.js';
import { ExpenseService } from '../../services/expense.service.js';
import { logger } from '../../utils/logger.js';
import { escapeMd } from '../../utils/markdown.js';

export const handleExpense = async (ctx) => {
  try {
    const text = ctx.message?.text || '';
    const parsed = parseExpenseCommand(text);
    const user = ctx.state.user;

    if (!user) {
      return ctx.reply('⚠️ User profile could not be verified. Please try running /start first.');
    }

    const expense = await ExpenseService.addExpense({
      userId: user.id,
      amount: parsed.amount,
      category: parsed.category,
      note: parsed.note,
    });

    const formattedDate = new Date(expense.createdAt).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const formattedAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(expense.amount);

    const name = escapeMd(ctx.from.first_name || 'Anonymous');
    const handle = escapeMd(ctx.from.username || 'n/a');
    const category = escapeMd(expense.category);
    const note = escapeMd(expense.note);

    const message =
      `✅ *Expense Recorded Successfully!*\n\n` +
      `💵 *Amount:* ${formattedAmount}\n` +
      `🏷️ *Category:* ${category}\n` +
      `📝 *Note:* ${note}\n` +
      `👤 *Logged By:* ${name} (@${handle})\n` +
      `📅 *Date & Time:* ${formattedDate}`;

    return ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.warn(`Invalid /expense command input by user ${ctx.from?.id}: ${error.message}`);
    return ctx.reply(`⚠️ ${error.message}`);
  }
};
