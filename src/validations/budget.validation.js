import { z } from 'zod';

export const budgetInputSchema = z.object({
  amount: z
    .number({ invalid_type_error: 'Budget amount must be a valid number' })
    .positive('Budget amount must be greater than 0'),
});

export const parseBudgetCommand = (text) => {
  // Format: /setbudget <amount>
  // Example: /setbudget 100000
  const parts = text.trim().split(/\s+/);
  parts.shift(); // Remove command (/setbudget)

  if (parts.length < 1) {
    throw new Error('Invalid format. Usage: `/setbudget <amount>`\nExample: `/setbudget 100000`');
  }

  const amount = parseFloat(parts[0]);

  const parsed = budgetInputSchema.safeParse({ amount });

  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(', ');
    throw new Error(errorMsg);
  }

  return parsed.data;
};
