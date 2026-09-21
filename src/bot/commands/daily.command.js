import { ExpenseService } from '../../services/expense.service.js';
import { escapeMd } from '../../utils/markdown.js';

export const handleDaily = async (ctx) => {
  try {
    const report = await ExpenseService.getDailyReport();

    const formattedTotal = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(report.totalSpent);

    const formattedDate = report.date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let message = `📊 *Daily Spending Report*\n📅 ${formattedDate}\n\n`;

    message += `💰 *Today's Total:* ${formattedTotal}\n`;
    message += `🔢 *Total Transactions:* ${report.count}\n\n`;

    if (report.categoryBreakdown.length === 0) {
      message += `ℹ️ _No expenses recorded for today yet._`;
    } else {
      message += `🏷️ *Category Breakdown:*\n`;
      report.categoryBreakdown.forEach((item) => {
        const catAmount = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
        }).format(item.amount);
        message += `• *${escapeMd(item.category)}:* ${catAmount} (${item.count} expense${item.count > 1 ? 's' : ''})\n`;
      });
    }

    return ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    return ctx.reply('⚠️ Failed to generate daily spending report.');
  }
};
