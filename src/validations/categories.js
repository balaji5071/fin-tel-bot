export const DEFAULT_CATEGORIES = [
  'Travel',
  'Food',
  'Software',
  'Marketing',
  'Office',
  'Salary',
  'Misc',
  'Other',
];

/**
 * Normalizes a category string to match official category casing,
 * or defaults to matching standard categories.
 */
export const normalizeCategory = (inputCategory) => {
  if (!inputCategory) return null;
  const match = DEFAULT_CATEGORIES.find(
    (cat) => cat.toLowerCase() === inputCategory.toLowerCase()
  );
  if (match) return match;

  // Capitalize first letter if custom
  return inputCategory.charAt(0).toUpperCase() + inputCategory.slice(1).toLowerCase();
};
