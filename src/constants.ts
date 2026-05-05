export const CATEGORIES = ['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Other'] as const;

export type Category = (typeof CATEGORIES)[number];

export const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Investment', 'Gift', 'Refund', 'Other'] as const;

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

export const CATEGORY_CHART_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#059669',
  '#64748b',
  '#0d9488',
  '#ca8a04',
] as const;

export const COMMON_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CAD',
  'AUD',
  'CHF',
  'MXN',
  'INR',
  'BRL',
] as const;
