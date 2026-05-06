import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export type CategoryGlyph = NonNullable<ComponentProps<typeof Ionicons>['name']>;

const EXPENSE_ICONS: Record<string, CategoryGlyph> = {
  Food: 'restaurant-outline',
  Transport: 'car-outline',
  Bills: 'document-text-outline',
  Shopping: 'cart-outline',
  Health: 'medical-outline',
  Other: 'apps-outline',
};

const INCOME_ICONS: Record<string, CategoryGlyph> = {
  Salary: 'wallet-outline',
  Freelance: 'laptop-outline',
  Investment: 'trending-up-outline',
  Gift: 'gift-outline',
  Refund: 'return-down-back-outline',
  Other: 'apps-outline',
};

/** Distinct tints for default categories (aligned with chart hues where possible). */
const EXPENSE_COLORS: Record<string, string> = {
  Food: '#2563eb',
  Transport: '#7c3aed',
  Bills: '#db2777',
  Shopping: '#ea580c',
  Health: '#059669',
  Other: '#64748b',
};

const INCOME_COLORS: Record<string, string> = {
  Salary: '#0d9488',
  Freelance: '#ca8a04',
  Investment: '#059669',
  Gift: '#e11d48',
  Refund: '#6366f1',
  Other: '#64748b',
};

const CUSTOM_COLOR_CYCLE = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#059669',
  '#0d9488',
  '#ca8a04',
  '#6366f1',
] as const;

function paletteColorForCustom(category: string, kind: 'expense' | 'income'): string {
  const key = `${kind}:${category}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return CUSTOM_COLOR_CYCLE[Math.abs(h) % CUSTOM_COLOR_CYCLE.length]!;
}

/** Hex color for category icons (custom names get a stable hue from the name). */
export function categoryIconColor(category: string, kind: 'expense' | 'income'): string {
  const table = kind === 'expense' ? EXPENSE_COLORS : INCOME_COLORS;
  return table[category] ?? paletteColorForCustom(category, kind);
}

/** Small Ionicons name for a spending or income category (custom categories fall back to a tag icon). */
export function categoryGlyph(category: string, kind: 'expense' | 'income'): CategoryGlyph {
  const table = kind === 'expense' ? EXPENSE_ICONS : INCOME_ICONS;
  return table[category] ?? 'pricetag-outline';
}
