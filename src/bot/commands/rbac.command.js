import { UserService } from '../../services/user.service.js';
import { PERMISSIONS } from '../../services/permission.service.js';
import { escapeMd } from '../../utils/markdown.js';

export const handleAddAdmin = async (ctx) => {
  const target = ctx.message.text.split(/\s+/)[1];
  if (!target) return ctx.reply('⚠️ Usage: `/addadmin <@username or telegramId>`', { parse_mode: 'Markdown' });

  try {
    const updated = await UserService.updateUserRole(ctx.state.user, target, 'ADMIN');
    const name = escapeMd(updated.firstName);
    const handle = escapeMd(updated.username || updated.telegramId.toString());
    return ctx.reply(`✅ User *${name}* (@${handle}) promoted to *ADMIN*.`, {
      parse_mode: 'Markdown',
    });
  } catch (error) {
    return ctx.reply(`⚠️ ${error.message}`);
  }
};

export const handleRemoveAdmin = async (ctx) => {
  const target = ctx.message.text.split(/\s+/)[1];
  if (!target) return ctx.reply('⚠️ Usage: `/removeadmin <@username or telegramId>`', { parse_mode: 'Markdown' });

  try {
    const updated = await UserService.updateUserRole(ctx.state.user, target, 'EMPLOYEE');
    const name = escapeMd(updated.firstName);
    const handle = escapeMd(updated.username || updated.telegramId.toString());
    return ctx.reply(`✅ User *${name}* (@${handle}) demoted to *EMPLOYEE*.`, {
      parse_mode: 'Markdown',
    });
  } catch (error) {
    return ctx.reply(`⚠️ ${error.message}`);
  }
};

export const handleAddManager = async (ctx) => {
  const target = ctx.message.text.split(/\s+/)[1];
  if (!target) return ctx.reply('⚠️ Usage: `/addmanager <@username or telegramId>`', { parse_mode: 'Markdown' });

  try {
    const updated = await UserService.updateUserRole(ctx.state.user, target, 'MANAGER');
    const name = escapeMd(updated.firstName);
    const handle = escapeMd(updated.username || updated.telegramId.toString());
    return ctx.reply(`✅ User *${name}* (@${handle}) promoted to *MANAGER*.`, {
      parse_mode: 'Markdown',
    });
  } catch (error) {
    return ctx.reply(`⚠️ ${error.message}`);
  }
};

export const handleRemoveManager = async (ctx) => {
  const target = ctx.message.text.split(/\s+/)[1];
  if (!target) return ctx.reply('⚠️ Usage: `/removemanager <@username or telegramId>`', { parse_mode: 'Markdown' });

  try {
    const updated = await UserService.updateUserRole(ctx.state.user, target, 'EMPLOYEE');
    const name = escapeMd(updated.firstName);
    const handle = escapeMd(updated.username || updated.telegramId.toString());
    return ctx.reply(`✅ User *${name}* (@${handle}) demoted to *EMPLOYEE*.`, {
      parse_mode: 'Markdown',
    });
  } catch (error) {
    return ctx.reply(`⚠️ ${error.message}`);
  }
};

export const handleListUsers = async (ctx) => {
  const users = await UserService.getAllUsers();
  let msg = `👥 *Registered Team Members (${users.length}):*\n\n`;

  users.forEach((u) => {
    const name = escapeMd(u.firstName);
    const handle = escapeMd(u.username || u.telegramId.toString());
    const dept = escapeMd(u.department || 'General');
    msg += `• *${name}* (@${handle})\n  Role: \`${u.role}\` | Dept: \`${dept}\` | ID: \`${u.telegramId}\` \n`;
  });

  return ctx.reply(msg, { parse_mode: 'Markdown' });
};

export const handleListPermissions = async (ctx) => {
  let msg = `🔐 *Available System Permissions:*\n\n`;
  Object.values(PERMISSIONS).forEach((p) => {
    msg += `• \`${p}\`\n`;
  });
  return ctx.reply(msg, { parse_mode: 'Markdown' });
};

export const handleGrantPermission = async (ctx) => {
  const parts = ctx.message.text.split(/\s+/);
  if (parts.length < 3) return ctx.reply('⚠️ Usage: `/grant <@username or telegramId> <PERMISSION>`', { parse_mode: 'Markdown' });

  const target = parts[1];
  const permission = parts[2].toUpperCase();

  try {
    const updated = await UserService.grantPermission(ctx.state.user, target, permission);
    const name = escapeMd(updated.firstName);
    return ctx.reply(`✅ Granted permission \`${permission}\` to *${name}*.`, { parse_mode: 'Markdown' });
  } catch (error) {
    return ctx.reply(`⚠️ ${error.message}`);
  }
};

export const handleRevokePermission = async (ctx) => {
  const parts = ctx.message.text.split(/\s+/);
  if (parts.length < 3) return ctx.reply('⚠️ Usage: `/revoke <@username or telegramId> <PERMISSION>`', { parse_mode: 'Markdown' });

  const target = parts[1];
  const permission = parts[2].toUpperCase();

  try {
    const updated = await UserService.revokePermission(ctx.state.user, target, permission);
    const name = escapeMd(updated.firstName);
    return ctx.reply(`✅ Revoked permission \`${permission}\` from *${name}*.`, { parse_mode: 'Markdown' });
  } catch (error) {
    return ctx.reply(`⚠️ ${error.message}`);
  }
};
