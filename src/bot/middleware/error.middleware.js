import { logger } from '../../utils/logger.js';

export const errorHandler = async (err, ctx) => {
  logger.error(`Error handling update ${ctx.update.update_id}:`, err);

  const errorMessage = '⚠️ An unexpected error occurred while processing your request. Please try again later.';

  try {
    if (ctx.deferred || ctx.replied) {
      await ctx.followUp(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  } catch (replyErr) {
    logger.error('Failed to send error reply to user:', replyErr);
  }
};
