import { ReportingService } from '../../services/reporting.service.js';
import { ExpenseService } from '../../services/expense.service.js';
import { escapeMd } from '../../utils/markdown.js';

export const handleWeekly = async (ctx) => {
  try {
    const report = await ReportingService.getWeeklyReport();
    const fmtTotal = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(report.totalSpent);

    let msg = `📅 *Weekly Spending Overview (Last 7 Days)*\n\n`;
    msg += `💰 *Total Spent:* ${fmtTotal}\n`;
    msg += `🔢 *Total Expenses:* ${report.count}\n\n`;

    if (report.categoryBreakdown.length > 0) {
      msg += `🏷️ *Category Breakdown:*\n`;
      report.categoryBreakdown.forEach((c) => {
        const fmtAmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(c.amount);
        msg += `• *${escapeMd(c.category)}:* ${fmtAmt}\n`;
      });
    }

    return ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (error) {
    return ctx.reply('⚠️ Failed to generate weekly report.');
  }
};

export const handleTopSpenders = async (ctx) => {
  try {
    const spenders = await ReportingService.getTopSpenders(5);

    let msg = `🏆 *Top Spenders This Month:*\n\n`;
    if (spenders.length === 0) {
      msg += `_No spending recorded this month yet._`;
    } else {
      spenders.forEach((s, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤';
        const fmtAmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(s.amount);
        msg += `${medal} *${escapeMd(s.name)}:* ${fmtAmt} (${s.count} transactions)\n`;
      });
    }

    return ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (error) {
    return ctx.reply('⚠️ Failed to load top spenders leaderboard.');
  }
};

export const handleDepartmentReport = async (ctx) => {
  try {
    const depts = await ReportingService.getDepartmentReport();

    let msg = `🏢 *Department Spending Breakdown (Current Month)*\n\n`;
    if (depts.length === 0) {
      msg += `_No department spending recorded for this month._`;
    } else {
      depts.forEach((d) => {
        const fmtAmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(d.amount);
        msg += `• *${escapeMd(d.department)}:* ${fmtAmt}\n`;
      });
    }

    return ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (error) {
    return ctx.reply('⚠️ Failed to load department report.');
  }
};

export const handleCategoryReport = async (ctx) => {
  try {
    const report = await ExpenseService.getMonthlyReport();
    let msg = `🏷️ *Category Analytics Report*\n\n`;

    if (report.categoryBreakdown.length === 0) {
      msg += `_No data for this month._`;
    } else {
      report.categoryBreakdown.forEach((c) => {
        const pct = ((c.amount / report.totalSpent) * 100).toFixed(1);
        const fmtAmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(c.amount);
        msg += `• *${escapeMd(c.category)}:* ${fmtAmt} (${pct}% of total)\n`;
      });
    }

    return ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (error) {
    return ctx.reply('⚠️ Failed to generate category analytics report.');
  }
};
