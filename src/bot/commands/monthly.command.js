import { ExpenseService } from '../../services/expense.service.js';
import { escapeMd } from '../../utils/markdown.js';

export const handleMonthly = async (ctx) => {
  try {
    const report = await ExpenseService.getMonthlyReport();

    const monthName = new Date(report.year, report.month - 1, 1).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    const formattedTotal = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(report.totalSpent);

    let message = `📈 *Monthly Finance Summary*\n🗓️ *${monthName}*\n\n`;

    message += `💰 *Total Spent This Month:* ${formattedTotal}\n`;
    message += `🔢 *Total Expenses:* ${report.count}\n`;

    if (report.topCategory) {
      const topCatAmount = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
      }).format(report.topCategory.amount);
      message += `🏆 *Top Spending Category:* ${escapeMd(report.topCategory.category)} (${topCatAmount})\n`;
    }

    message += `\n🏷️ *Category-wise Breakdown:*\n`;

    if (report.categoryBreakdown.length === 0) {
      message += `_No expenses recorded for this month yet._`;
    } else {
      report.categoryBreakdown.forEach((item) => {
        const catAmount = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
        }).format(item.amount);
        const percentage = ((item.amount / report.totalSpent) * 100).toFixed(1);
        message += `• *${escapeMd(item.category)}:* ${catAmount} (${percentage}%, ${item.count} items)\n`;
      });
    }

    return ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    return ctx.reply('⚠️ Failed to generate monthly report.');
  }
};
