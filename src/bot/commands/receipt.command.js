import { ReceiptService } from '../../services/receipt.service.js';
import { logger } from '../../utils/logger.js';

export const handlePhotoUpload = async (ctx) => {
  if (!ctx.message?.photo || ctx.message.photo.length === 0) return;

  const photo = ctx.message.photo[ctx.message.photo.length - 1]; // highest resolution photo
  const fileId = photo.file_id;
  const user = ctx.state.user;

  if (!user) return ctx.reply('⚠️ User profile not identified.');

  try {
    ctx.reply('🔍 *Receipt Received! Processing image with OCR Provider...*', { parse_mode: 'Markdown' });

    const receipt = await ReceiptService.saveReceipt({
      fileId,
      uploadedBy: user.id,
    });

    const fmtAmount = receipt.extractedAmount ? `₹${receipt.extractedAmount.toLocaleString('en-IN')}` : 'Not Detected';
    const vendor = receipt.extractedVendor || 'Not Detected';
    const gst = receipt.extractedGst || 'Not Detected';

    const msg =
      `📄 *Receipt Processed & Saved! (Receipt ID #${receipt.id})*\n\n` +
      `🔍 *OCR Extracted Insights:*\n` +
      `💵 *Extracted Amount:* ${fmtAmount}\n` +
      `🏪 *Extracted Vendor:* ${vendor}\n` +
      `📑 *Extracted GST:* \`${gst}\`\n\n` +
      `💡 *To link this receipt to an expense:* Send \`/expense <amount> <category> <note>\` or link via Receipt ID #${receipt.id}.`;

    return ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error('Error handling photo receipt upload:', error);
    return ctx.reply('⚠️ Failed to process receipt image.');
  }
};
