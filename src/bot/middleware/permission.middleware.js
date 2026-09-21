import { PermissionService } from '../../services/permission.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Middleware factory to enforce specific granular permissions
 * @param {string} permission - Permission key from PERMISSIONS enum
 */
export const requirePermission = (permission) => {
  return async (ctx, next) => {
    const user = ctx.state?.user;

    if (!user) {
      return ctx.reply('🚫 *Unauthorized*: User account could not be identified.', { parse_mode: 'Markdown' });
    }

    const allowed = PermissionService.hasPermission(user, permission);

    if (!allowed) {
      logger.warn(`User ${user.id} (${user.username || 'NoUser'}) denied permission '${permission}'`);
      return ctx.reply(
        `🚫 *Access Denied*\n\n` +
          `You require permission \`${permission}\` to execute this command.\n` +
          `Your current role is: *${user.role}*.`,
        { parse_mode: 'Markdown' }
      );
    }

    return next();
  };
};
