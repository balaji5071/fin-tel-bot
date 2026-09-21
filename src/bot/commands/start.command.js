import { escapeMd } from '../../utils/markdown.js';

export const handleStart = async (ctx) => {
  const name = escapeMd(ctx.from?.first_name || 'Team Member');

  const welcomeText =
    `👋 *Hello ${name}! I'm your AI Financial Employee.*\n\n` +
    `You can talk to me completely naturally—no complex commands or rigid syntax required.\n\n` +
    `💬 *Here are a few things you can say to me:*\n` +
    `• _"Spent 500 on petrol today"_\n` +
    `• _"Recorded 50,000 income from client"_\n` +
    `• _"How much did we spend this month?"_\n` +
    `• _"Show me all travel expenses"_\n` +
    `• _"Did we spend more than last month?"_\n` +
    `• _"What is our budget status?"_\n` +
    `• _"Delete the petrol expense I added today"_\n\n` +
    `📋 *Pasted reports & bulk entries:*\n` +
    `Paste multiple expenses at once:\n` +
    `_Tea: 100_\n` +
    `_Lunch: 300_\n` +
    `_Petrol: 500_\n\n` +
    `🎙️ *Voice Notes:* You can also send me voice messages anytime!\n\n` +
    `How can I assist you with your finances today?`;

  return ctx.reply(welcomeText, { parse_mode: 'Markdown' });
};
