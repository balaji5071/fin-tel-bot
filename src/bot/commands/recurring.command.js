import { RecurringExpenseService } from '../../services/recurring.service.js';

export const handleRecurring = async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length < 4) {
    return ctx.reply(
      '⚠️ Usage: `/recurring <amount> <category> <frequency> <note>`\n' +
        'Frequencies: `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`\n' +
        'Example: `/recurring 2000 Software Monthly ChatGPT Subscription`',
      { parse_mode: 'Markdown' }
    );
  }

  const amount = parseFloat(parts[1]);
  const category = parts[2];
  const frequency = parts[3].toUpperCase();
  const note = parts.slice(4).join(' ');

  if (isNaN(amount) || amount <= 0) return ctx.reply('⚠️ Amount must be a positive number.');

  const validFrequencies = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
  if (!validFrequencies.includes(frequency)) {
    return ctx.reply('⚠️ Frequency must be one of: `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`.', { parse_mode: 'Markdown' });
  }

  try {
    const recurring = await RecurringExpenseService.addRecurringExpense({
      userId: ctx.state.user.id,
      amount,
      category,
      frequency,
      note,
    });

    const fmtNextRun = new Date(recurring.nextRun).toLocaleDateString('en-US', { dateStyle: 'medium' });

    return ctx.reply(
      `🔄 *Recurring Expense Scheduled!*\n\n` +
        `💵 *Amount:* ₹${recurring.amount.toLocaleString('en-IN')}\n` +
        `🏷️ *Category:* ${recurring.category}\n` +
        `🔁 *Frequency:* ${recurring.frequency}\n` +
        `📝 *Note:* ${recurring.note || 'None'}\n` +
        `📅 *Next Auto Run:* ${fmtNextRun}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    return ctx.reply(`⚠️ ${error.message}`);
  }
};
