import { VendorService } from '../../services/vendor.service.js';
import { escapeMd } from '../../utils/markdown.js';

export const handleVendors = async (ctx) => {
  try {
    const vendors = await VendorService.getAllVendors();
    if (vendors.length === 0) {
      return ctx.reply('🏪 _No vendors registered in database yet._', { parse_mode: 'Markdown' });
    }

    let msg = `🏪 *Registered Vendors (${vendors.length}):*\n\n`;
    vendors.forEach((v) => {
      msg += `• *${escapeMd(v.name)}* (${v._count.expenses} total transactions)\n`;
    });

    return ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (error) {
    return ctx.reply('⚠️ Failed to load vendors.');
  }
};

export const handleVendorDetails = async (ctx) => {
  const nameInput = ctx.message.text.split(/\s+/).slice(1).join(' ');
  if (!nameInput) return ctx.reply('⚠️ Usage: `/vendor <VendorName>`\nExample: `/vendor AWS`', { parse_mode: 'Markdown' });

  try {
    const report = await VendorService.getVendorReport(nameInput);
    const fmtTotal = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(report.totalSpent);

    let msg = `🏪 *Vendor Spend Report: ${escapeMd(nameInput)}*\n\n`;
    msg += `💰 *Total Spent This Month:* ${fmtTotal}\n`;
    msg += `🔢 *Transactions Count:* ${report.count}\n\n`;

    if (report.expenses.length > 0) {
      msg += `📋 *Recent Transactions:*\n`;
      report.expenses.slice(0, 5).forEach((e) => {
        const dateStr = new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const fmtAmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(e.amount);
        msg += `• [${dateStr}] *${fmtAmt}* - ${escapeMd(e.note || 'No note')}\n`;
      });
    }

    return ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (error) {
    return ctx.reply(`⚠️ ${error.message}`);
  }
};

export const handleVendorReport = async (ctx) => {
  try {
    const report = await VendorService.getVendorReport();
    const fmtTotal = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(report.totalSpent);

    let msg = `📊 *Vendor Spending Breakdown (Current Month)*\n\n`;
    msg += `💰 *Total Vendor Spend:* ${fmtTotal}\n\n`;

    if (report.vendorBreakdown.length === 0) {
      msg += `_No vendor expenses logged for this month._`;
    } else {
      report.vendorBreakdown.forEach((v) => {
        const amtStr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v.amount);
        msg += `• *${escapeMd(v.name)}:* ${amtStr} (${v.count} items)\n`;
      });
    }

    return ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (error) {
    return ctx.reply('⚠️ Failed to generate vendor report.');
  }
};
