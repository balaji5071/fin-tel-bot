import { AuditService } from '../../services/audit.service.js';
import { escapeMd } from '../../utils/markdown.js';

export const handleAuditLogs = async (ctx) => {
  try {
    const { logs, total } = await AuditService.getAuditLogs({ limit: 10, page: 1 });

    if (logs.length === 0) {
      return ctx.reply('📜 _No audit logs recorded yet._', { parse_mode: 'Markdown' });
    }

    let msg = `📜 *Audit Log History (Showing last ${logs.length} of ${total}):*\n\n`;

    logs.forEach((l) => {
      const time = new Date(l.createdAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
      const actorName = escapeMd(l.actor?.firstName || 'System');
      const targetStr = escapeMd(l.target || 'N/A');
      msg += `• *${time}* | *${l.action}*\n  Actor: ${actorName} | Target: \`${targetStr}\`\n`;
    });

    return ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (error) {
    return ctx.reply('⚠️ Failed to load audit logs.');
  }
};
