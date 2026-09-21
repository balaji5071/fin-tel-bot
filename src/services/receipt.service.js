import prisma from '../database/prisma.js';
import { logger } from '../utils/logger.js';
import { PatternMockOCRProvider } from './ocr/ocr.provider.js';

const defaultOCRProvider = new PatternMockOCRProvider();

export class ReceiptService {
  /**
   * Save a receipt file uploaded by user
   */
  static async saveReceipt({ fileId, uploadedBy, expenseId = null }) {
    try {
      const receipt = await prisma.expenseReceipt.create({
        data: {
          fileId,
          uploadedBy,
          expenseId,
        },
      });

      // Run OCR Extraction automatically
      const extracted = await defaultOCRProvider.extractData(fileId);

      const updated = await prisma.expenseReceipt.update({
        where: { id: receipt.id },
        data: {
          extractedAmount: extracted.amount,
          extractedVendor: extracted.vendor,
          extractedDate: extracted.date,
          extractedGst: extracted.gstNumber,
        },
      });

      logger.info(`Receipt #${receipt.id} processed via OCR`);
      return updated;
    } catch (error) {
      logger.error('Error saving receipt:', error);
      throw error;
    }
  }

  /**
   * Confirm receipt and link to expense
   */
  static async confirmReceipt(receiptId, expenseId) {
    return prisma.expenseReceipt.update({
      where: { id: receiptId },
      data: {
        confirmed: true,
        expenseId,
      },
    });
  }

  /**
   * Get unconfirmed receipt for user
   */
  static async getUnconfirmedReceipt(uploadedBy) {
    return prisma.expenseReceipt.findFirst({
      where: {
        uploadedBy,
        confirmed: false,
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }
}
