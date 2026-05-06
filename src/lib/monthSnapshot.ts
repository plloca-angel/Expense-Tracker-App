import { byCategory, totalIncome, totalSpent } from './aggregates';
import { spendChangeVsPreviousMonth } from './insights';
import type { Expense } from '../types/expense';
import type { Income } from '../types/income';

export type MonthSnapshot = {
  ym: string;
  label: string;
  spent: number;
  earned: number;
  net: number;
  topCategories: { category: string; total: number }[];
  vsPrevious: ReturnType<typeof spendChangeVsPreviousMonth>;
};

export function buildMonthSnapshot(
  expenses: Expense[],
  incomes: Income[],
  ym: string,
  label: string
): MonthSnapshot {
  const monthExp = expenses.filter((e) => e.date.slice(0, 7) === ym);
  const monthInc = incomes.filter((i) => i.date.slice(0, 7) === ym);
  const spent = totalSpent(monthExp);
  const earned = totalIncome(monthInc);
  const topCategories = byCategory(monthExp).slice(0, 5);
  return {
    ym,
    label,
    spent,
    earned,
    net: earned - spent,
    topCategories,
    vsPrevious: spendChangeVsPreviousMonth(expenses, ym),
  };
}

export function formatSnapshotShareText(s: MonthSnapshot, currency: string, formatMoney: (n: number, c: string) => string): string {
  const lines: string[] = [
    `Month: ${s.label}`,
    `Net: ${formatMoney(s.net, currency)}`,
    `Expenses: ${formatMoney(s.spent, currency)} · Income: ${formatMoney(s.earned, currency)}`,
  ];
  if (s.topCategories.length > 0) {
    lines.push('Top categories:');
    for (const t of s.topCategories) {
      lines.push(`· ${t.category}: ${formatMoney(t.total, currency)}`);
    }
  }
  if (s.vsPrevious.pctChange !== null) {
    lines.push(`vs ${s.vsPrevious.prevYm}: ${s.vsPrevious.pctChange > 0 ? '+' : ''}${s.vsPrevious.pctChange.toFixed(0)}% spending`);
  }
  lines.push('', '— Expense Tracker');
  return lines.join('\n');
}
