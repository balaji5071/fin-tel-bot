import { ReportingService } from '../../services/reporting.service.js';

export const handleFounderDashboard = async (ctx) => {
  try {
    const data = await ReportingService.getFounderDashboard();

    const fmtYesterday = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(data.yesterdaySpend);
    const fmtWeekly = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(data.weeklySpend);
    const fmtMonthly = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(data.monthlySpend);
    const fmtProjected = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(data.projectedSpend);
    const fmtCash = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(data.cashBalance);

    let msg = `👔 *FOUNDER DASHBOARD OVERVIEW*\n\n`;
    msg += `📉 *Yesterday Spend:* ${fmtYesterday}\n`;
    msg += `📅 *7-Day Spend:* ${fmtWeekly}\n`;
    msg += `🗓️ *Current Month Spend:* ${fmtMonthly}\n`;
    msg += `📈 *Projected Month-End Spend:* ${fmtProjected}\n\n`;
    msg += `💰 *Bank Cash Balance:* ${fmtCash}\n`;
    msg += `🔋 *Estimated Runway:* *${data.runwayMonths} months*\n\n`;

    if (data.topSpenders.length > 0) {
      msg += `🏆 *Top Spenders This Month:*\n`;
      data.topSpenders.forEach((s) => {
        const fmtAmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(s.amount);
        msg += `• ${s.name}: ${fmtAmt}\n`;
      });
    }

    return ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (error) {
    return ctx.reply('⚠️ Failed to load founder dashboard.');
  }
};

export const handleBurnRate = async (ctx) => {
  try {
    const runway = await ReportingService.calculateRunway();
    const fmtBurn = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(runway.avgMonthlyBurn);

    return ctx.reply(
      `🔥 *Company Monthly Burn Rate*\n\n` +
        `💸 *Average Monthly Burn (Last 3 months):* ${fmtBurn}\n` +
        `🔋 *Estimated Runway:* *${runway.runwayMonths} months*\n\n` +
        `Use \`/setcash <amount>\` to update current bank cash balance.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    return ctx.reply('⚠️ Failed to calculate burn rate.');
  }
};

export const handleRunway = async (ctx) => {
  try {
    const runway = await ReportingService.calculateRunway();
    const fmtCash = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(runway.cashBalance);
    const fmtBurn = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(runway.avgMonthlyBurn);

    return ctx.reply(
      `🔋 *Startup Runway Overview*\n\n` +
        `💰 *Cash Balance:* ${fmtCash}\n` +
        `🔥 *Monthly Burn Rate:* ${fmtBurn}\n` +
        `🚀 *Runway Remaining:* *${runway.runwayMonths} Months*`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    return ctx.reply('⚠️ Failed to calculate runway.');
  }
};

export const handleSetCash = async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length < 2) {
    return ctx.reply('⚠️ Usage: `/setcash <amount>`\nExample: `/setcash 500000`', { parse_mode: 'Markdown' });
  }

  const amount = parseFloat(parts[1]);
  if (isNaN(amount) || amount < 0) {
    return ctx.reply('⚠️ Cash balance must be a valid non-negative number.');
  }

  try {
    const record = await ReportingService.setCashBalance(amount, ctx.state.user);
    const fmtCash = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(record.amount);

    return ctx.reply(`✅ *Company Cash Balance Updated to ${fmtCash}!*`, { parse_mode: 'Markdown' });
  } catch (error) {
    return ctx.reply(`⚠️ ${error.message}`);
  }
};

export const handleForecast = async (ctx) => {
  try {
    const forecast = await ReportingService.calculateForecast();
    const fmtCurrent = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(forecast.currentMonthSpend);
    const fmtAvgDaily = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(forecast.avgDailySpend);
    const fmtProjected = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(forecast.projectedSpend);

    return ctx.reply(
      `📊 *Month-End Spend Forecast*\n\n` +
        `📅 *Progress:* Day ${forecast.daysPassed} of ${forecast.totalDaysInMonth}\n` +
        `💵 *Current Spend:* ${fmtCurrent}\n` +
        `📈 *Average Daily Spend:* ${fmtAvgDaily}\n` +
        `🎯 *Projected Month-End Total:* *${fmtProjected}*`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    return ctx.reply('⚠️ Failed to calculate forecast.');
  }
};
