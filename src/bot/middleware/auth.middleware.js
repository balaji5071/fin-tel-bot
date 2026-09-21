import { UserService } from '../../services/user.service.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

/**
 * Middleware to auto-register/find user in database and attach to ctx.state.user
 */
export const ensureUser = async (ctx, next) => {
  if (!ctx.from) {
    return next();
  }

  try {
    const user = await UserService.findOrCreateUser(ctx.from);
    ctx.state = ctx.state || {};
    ctx.state.user = user;
    return next();
  } catch (error) {
    logger.error('Failed to ensure user in middleware:', error);
    await ctx.reply('⚠️ An error occurred while authenticating your account.');
  }
};

/**
 * Middleware to restrict command execution to Telegram users listed in ADMIN_IDS
 */
export const adminOnly = async (ctx, next) => {
  if (!ctx.from) {
    return ctx.reply('🚫 Unauthorized: Cannot verify user identity.');
  }

  const userIdStr = ctx.from.id.toString();
  const isAdmin = config.ADMIN_IDS.includes(userIdStr);

  if (!isAdmin) {
    logger.warn(`Unauthorized admin command attempt by user ID ${userIdStr} (${ctx.from.username || 'NoUsername'})`);
    return ctx.reply('🚫 *Access Denied*: You do not have permission to execute this administrative command.', {
      parse_mode: 'Markdown',
    });
  }

  return next();
};
