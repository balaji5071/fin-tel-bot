import { ExpenseService } from '../../services/expense.service.js';
import { escapeMd } from '../../utils/markdown.js';

export const handleEditExpense = async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length < 4) {
    return ctx.reply('⚠️ Usage: `/editexpense <id> <amount|category|note> <new_value>`\nExample: `/editexpense 12 amount 650`', {
      parse_mode: 'Markdown',
    });
  }

  const id = parseInt(parts[1], 10);
  const field = parts[2].toLowerCase();
  const value = parts.slice(3).join(' ');

  if (isNaN(id)) return ctx.reply('⚠️ Expense ID must be a valid number.');

  const updates = {};
  if (field === 'amount') {
    const parsedAmount = parseFloat(value);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return ctx.reply('⚠️ Amount must be a positive number.');
    updates.amount = parsedAmount;
  } else if (field === 'category') {
    updates.category = value;
  } else if (field === 'note') {
    updates.note = value;
  } else {
    return ctx.reply('⚠️ Field to update must be one of: `amount`, `category`, `note`.', { parse_mode: 'Markdown' });
  }

  try {
    const updated = await ExpenseService.editExpense(id, ctx.state.user, updates);
    const cat = escapeMd(updated.category);
    const note = escapeMd(updated.note || 'None');
    return ctx.reply(
      `✅ *Expense #${updated.id} Updated!*\n\n` +
        `💵 *Amount:* ₹${updated.amount.toLocaleString('en-IN')}\n` +
        `🏷️ *Category:* ${cat}\n` +
        `📝 *Note:* ${note}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    return ctx.reply(`⚠️ ${error.message}`);
  }
};

export const handleDeleteExpense = async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length < 2) {
    return ctx.reply('⚠️ Usage: `/deleteexpense <id>`\nExample: `/deleteexpense 12`', { parse_mode: 'Markdown' });
  }

  const id = parseInt(parts[1], 10);
  if (isNaN(id)) return ctx.reply('⚠️ Expense ID must be a valid number.');

  try {
    await ExpenseService.softDeleteExpense(id, ctx.state.user);
    return ctx.reply(`🗑️ *Expense #${id} has been deleted.*`, { parse_mode: 'Markdown' });
  } catch (error) {
    return ctx.reply(`⚠️ ${error.message}`);
  }
};
