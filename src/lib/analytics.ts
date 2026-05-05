import type { Expense } from '../types/expense';
import type { Income } from '../types/income';
import { byCategory } from './aggregates';
import { spendInYearMonth } from './insights';

/** YYYY-MM -> total spend per calendar day 1..31 */
export function spendByDayInMonth(expenses: Expense[], ym: string): Map<number, number> {
  const m = new Map<number, number>();
  for (const e of expenses) {
    if (!e.date.startsWith(ym)) continue;
    const day = Number.parseInt(e.date.slice(8, 10), 10);
    if (!Number.isFinite(day)) continue;
    m.set(day, (m.get(day) ?? 0) + e.amount);
  }
  return m;
}

export function daysInMonthYm(ym: string): number {
  const [y, mo] = ym.split('-').map(Number);
  return new Date(y, mo, 0).getDate();
}

export type CategoryMover = { category: string; current: number; previous: number; delta: number };

/** Categories with largest spend change between two YYYY-MM months. */
export function categoryMovers(expenses: Expense[], currentYm: string, previousYm: string): CategoryMover[] {
  const curMap = new Map<string, number>();
  const prevMap = new Map<string, number>();
  for (const e of expenses) {
    const ym = e.date.slice(0, 7);
    if (ym === currentYm) curMap.set(e.category, (curMap.get(e.category) ?? 0) + e.amount);
    if (ym === previousYm) prevMap.set(e.category, (prevMap.get(e.category) ?? 0) + e.amount);
  }
  const cats = new Set([...curMap.keys(), ...prevMap.keys()]);
  const rows: CategoryMover[] = [];
  for (const c of cats) {
    const current = curMap.get(c) ?? 0;
    const previous = prevMap.get(c) ?? 0;
    rows.push({ category: c, current, previous, delta: current - previous });
  }
  return rows.filter((r) => r.delta !== 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function incomeInYearMonth(incomes: Income[], ym: string): number {
  return incomes.filter((i) => i.date.slice(0, 7) === ym).reduce((s, i) => s + i.amount, 0);
}

export function netForMonth(expenses: Expense[], incomes: Income[], ym: string): number {
  return incomeInYearMonth(incomes, ym) - spendInYearMonth(expenses, ym);
}

export function topExpenseCategories(expenses: Expense[], ym: string, limit = 8) {
  const inMonth = expenses.filter((e) => e.date.slice(0, 7) === ym);
  return byCategory(inMonth).slice(0, limit);
}
