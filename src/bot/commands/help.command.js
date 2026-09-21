export const handleHelp = async (ctx) => {
  const helpText =
    `💡 *AI Financial Employee Guide*\n\n` +
    `You can speak with me naturally in English. I understand context, categories, date ranges, and comparative questions.\n\n` +
    `💬 *Natural Conversation Examples:*\n` +
    `• *Logging Expenses:* _"Spent ₹450 on client lunch"_, _"Uber ride 320"_\n` +
    `• *Bulk Pasted Reports:* Paste a multi-line list like:\n` +
    `   _Coffee: 120_\n` +
    `   _Snacks: 250_\n` +
    `   _Fuel: 600_\n` +
    `• *Income:* _"Received 25000 consulting fee"_\n` +
    `• *Real-time Insights:* _"How much did we spend today?"_, _"Show weekly expenses"_\n` +
    `• *Cost Analysis:* _"Did we spend more than last month?"_, _"What is our top category?"_\n` +
    `• *Corrections:* _"Change that to 550"_, _"Delete the petrol expense I added today"_\n` +
    `• *Company Health:* _"What is our budget status?"_, _"Show company runway & burn rate"_\n\n` +
    `📸 *Receipts:* Upload any receipt photo to auto-extract amount & vendor via OCR.\n` +
    `🎙️ *Voice:* Send me voice notes on Telegram for instant processing.`;

  return ctx.reply(helpText, { parse_mode: 'Markdown' });
};
