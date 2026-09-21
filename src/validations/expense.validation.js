import { z } from 'zod';
import { DEFAULT_CATEGORIES, normalizeCategory } from './categories.js';

export const expenseInputSchema = z.object({
  amount: z
    .number({ invalid_type_error: 'Amount must be a valid number' })
    .positive('Amount must be greater than 0'),
  category: z
    .string()
    .min(1, 'Category is required')
    .transform((cat) => normalizeCategory(cat)),
  note: z.string().min(1, 'Note is required'),
});

export const parseExpenseCommand = (text) => {
  // Format: /expense <amount> <category> <note...>
  // Example: /expense 500 Travel Taxi to client office
  const parts = text.trim().split(/\s+/);
  parts.shift(); // Remove command (/expense)

  if (parts.length < 3) {
    throw new Error(
      'Invalid format. Usage: `/expense <amount> <category> <note>`\nExample: `/expense 500 Travel Taxi to client office`'
    );
  }

  const amountStr = parts[0];
  const categoryStr = parts[1];
  const noteStr = parts.slice(2).join(' ');

  const amount = parseFloat(amountStr);

  const parsed = expenseInputSchema.safeParse({
    amount,
    category: categoryStr,
    note: noteStr,
  });

  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(', ');
    throw new Error(errorMsg);
  }

  return parsed.data;
};
