import { ExpenseService } from '../../services/expense.service.js';
import { escapeMd } from '../../utils/markdown.js';

export const handleHistory = async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/);
  const arg = parts[1] || '';

  let category = null;
  let days = null;
  let page = 1;

  if (arg.toLowerCase().endsWith('days')) {
    const num = parseInt(arg.replace(/days/i, ''), 10);
    if (!isNaN(num)) days = num;
  } else if (arg && arg.toLowerCase() !== 'user') {
    category = arg;
  }

  try {
    const userRole = ctx.state.user?.role;
    const userId = ctx.state.user?.id;

    const { expenses, total, totalPages } = await ExpenseService.getExpenseHistory({
      userId,
      userRole,
      category,
      days,
      page,
      limit: 8,
    });

    if (expenses.length === 0) {
      return ctx.reply('📑 _No expense history records found for the given criteria._', { parse_mode: 'Markdown' });
    }

    let msg = `📑 *Expense History (${expenses.length} of ${total}):*\n\n`;

    expenses.forEach((e) => {
      const dateStr = new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const userStr = escapeMd(e.user ? e.user.firstName : 'Unknown');
      const catStr = escapeMd(e.category);
      const noteStr = escapeMd(e.note || 'No note');
      msg += `• *#${e.id}* [${dateStr}] *₹${e.amount.toLocaleString('en-IN')}* - \`${catStr}\` (${userStr})\n  _${noteStr}_\n`;
    });

    msg += `\n📄 Page ${page} of ${totalPages}`;

    return ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (error) {
    return ctx.reply('⚠️ Failed to load expense history.');
  }
};
