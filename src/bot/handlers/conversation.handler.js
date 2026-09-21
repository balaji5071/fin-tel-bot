import { IntentService } from '../../services/ai/intent.service.js';
import { MultiEventProcessor } from '../../services/ai/multiEventProcessor.js';
import { ResponseGeneratorService } from '../../services/ai/responseGenerator.service.js';
import { ConversationService } from '../../services/conversation.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Main Conversational Message Handler for natural language interactions
 * Powered by the Multi-Event Financial Extraction Engine
 *
 * @param {import('telegraf').Context} ctx
 * @param {Function} next
 */
export const handleConversationalMessage = async (ctx, next) => {
  const text = ctx.message?.text?.trim();
  if (!text) {
    return next ? next() : undefined;
  }

  // If message starts with a slash command, delegate to legacy command router
  if (text.startsWith('/')) {
    return next ? next() : undefined;
  }

  const user = ctx.state.user;
  if (!user) {
    return ctx.reply('⚠️ I could not verify your employee account. Please try again in a moment.');
  }

  try {
    // Send typing status to give a natural conversational feel
    await ctx.sendChatAction('typing').catch(() => {});

    // 1. Retrieve recent conversational history for context
    const history = await ConversationService.getRecentHistory(user.id, 4);

    // 2. Financial Event Extraction Engine (Extracts ALL events from message)
    const financialMessage = await IntentService.detectIntent(text, history);

    // 3. Multi-Event Backend Processor (Atomic DB transactions & calculations)
    const backendData = await MultiEventProcessor.processEvents({
      financialMessage,
      user,
      rawMessage: text,
    });

    // 4. Response Generator Layer (Synthesizes natural executive response without doing math)
    const replyText = await ResponseGeneratorService.generateResponse({
      userMessage: text,
      intent: financialMessage.message_type,
      backendData,
      userName: user.firstName || 'there',
      user,
    });

    // 5. Send reply to Telegram (safely with Markdown or plain text fallback)
    try {
      await ctx.reply(replyText, { parse_mode: 'Markdown' });
    } catch (markdownErr) {
      // Fallback to plain text if markdown formatting has unmatched tags
      await ctx.reply(replyText);
    }

    // 6. Log conversation turns for multi-turn conversational context
    await ConversationService.logMessage({
      userId: user.id,
      role: 'user',
      content: text,
      intent: financialMessage.message_type,
      metadata: financialMessage,
    });

    await ConversationService.logMessage({
      userId: user.id,
      role: 'assistant',
      content: replyText,
      intent: financialMessage.message_type,
      metadata: backendData,
    });
  } catch (error) {
    logger.error('Error handling conversational message:', error);
    return ctx.reply(
      "I ran into an issue while processing your message. Could you try rephrasing or specify the amount and category directly?",
      { parse_mode: 'Markdown' }
    );
  }
};
