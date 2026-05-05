import type { Expense } from '../types/expense';
import { filterByPeriod, type PeriodFilter } from './period';
import { totalSpent } from './aggregates';

export function uniqueDayCount(dates: string[]): number {
  const set = new Set(dates.map((d) => d.slice(0, 10)));
  return Math.max(1, set.size);
}

/** Average daily spend over the period (rough: month = days elapsed this month; 30d = 30; all = unique expense days). */
export function averageDailySpend(expenses: Expense[], period: PeriodFilter): number {
  const filtered = filterByPeriod(expenses, period);
  if (filtered.length === 0) return 0;
  const total = totalSpent(filtered);
  let days: number;
  if (period === '30d') {
    days = 30;
  } else if (period === 'month') {
    const now = new Date();
    days = now.getDate();
  } else {
    days = uniqueDayCount(filtered.map((e) => e.date));
  }
  return total / days;
}

export function previousCalendarMonthYm(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function spendInYearMonth(expenses: Expense[], ym: string): number {
  return expenses.filter((e) => e.date.slice(0, 7) === ym).reduce((s, e) => s + e.amount, 0);
}

export function spendChangeVsPreviousMonth(expenses: Expense[], currentYm: string): {
  prevYm: string;
  current: number;
  previous: number;
  pctChange: number | null;
} {
  const [y, m] = currentYm.split('-').map(Number);
  const prev = new Date(y, m - 2, 1);
  const prevYm = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  const current = spendInYearMonth(expenses, currentYm);
  const previous = spendInYearMonth(expenses, prevYm);
  if (previous <= 0) return { prevYm, current, previous, pctChange: null };
  const pctChange = ((current - previous) / previous) * 100;
  return { prevYm, current, previous, pctChange };
}

export function topCategoryShare(expenses: Expense[], period: PeriodFilter): { category: string; share: number } | null {
  const filtered = filterByPeriod(expenses, period);
  const total = totalSpent(filtered);
  if (total <= 0) return null;
  const map = new Map<string, number>();
  for (const e of filtered) {
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  }
  let top = '';
  let max = 0;
  for (const [c, v] of map) {
    if (v > max) {
      max = v;
      top = c;
    }
  }
  if (!top) return null;
  return { category: top, share: max / total };
}
