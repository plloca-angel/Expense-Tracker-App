import type { Expense } from '../types/expense';

export function totalSpent(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export function byCategory(expenses: Expense[]): { category: string; total: number }[] {
  const map = new Map<string, number>();
  for (const e of expenses) {
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function lastNDaysByDay(
  expenses: Expense[],
  n: number
): { key: string; label: string; total: number }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: { key: string; label: string; total: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    days.push({ key, label, total: 0 });
  }
  const indexByKey = new Map(days.map((x, i) => [x.key, i] as const));
  for (const e of expenses) {
    const day = e.date.slice(0, 10);
    const idx = indexByKey.get(day);
    if (idx !== undefined) days[idx].total += e.amount;
  }
  return days;
}
