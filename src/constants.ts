export const CATEGORIES = ['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Other'] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_CHART_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#059669',
  '#64748b',
] as const;
