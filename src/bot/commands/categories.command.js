import { ExpenseService } from '../../services/expense.service.js';
import { DEFAULT_CATEGORIES } from '../../validations/categories.js';
import { escapeMd } from '../../utils/markdown.js';

export const handleCategories = async (ctx) => {
  try {
    const report = await ExpenseService.getMonthlyReport();

    const monthName = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

    let message = `📂 *Category Spending Breakdown (${monthName})*\n\n`;

    if (report.categoryBreakdown.length === 0) {
      message += `_No expenses logged for this month yet._\n\n`;
    } else {
      report.categoryBreakdown.forEach((item) => {
        const catAmount = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
        }).format(item.amount);
        message += `• *${escapeMd(item.category)}:* ${catAmount} (${item.count} items)\n`;
      });
      message += `\n`;
    }

    message += `🏷️ *Allowed Default Categories:*\n`;
    message += DEFAULT_CATEGORIES.map((cat) => `\`${cat}\``).join(', ');
    message += `\n\n💡 _Example usage:_ \`/expense 150 Software GitHub Subscription\``;

    return ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    return ctx.reply('⚠️ Failed to load category spending data.');
  }
};
