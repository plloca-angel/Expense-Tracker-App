import type { Expense } from '../types/expense';
import type { Income } from '../types/income';

export function totalSpent(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export function totalIncome(incomes: Income[]): number {
  return incomes.reduce((sum, e) => sum + e.amount, 0);
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

export function byIncomeCategory(incomes: Income[]): { category: string; total: number }[] {
  const map = new Map<string, number>();
  for (const e of incomes) {
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function lastNDaysByDay(
  rows: { date: string; amount: number }[],
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
  for (const e of rows) {
    const day = e.date.slice(0, 10);
    const idx = indexByKey.get(day);
    if (idx !== undefined) days[idx].total += e.amount;
  }
  return days;
}

/** Up to `maxDays` calendar days at the end of `[rangeStart, rangeEnd]` (inclusive), for bar charts. */
export function dailyTotalsInRangeTail(
  rows: { date: string; amount: number }[],
  rangeStart: string,
  rangeEnd: string,
  maxDays: number
): { key: string; label: string; total: number }[] {
  const start = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
  const end = rangeStart <= rangeEnd ? rangeEnd : rangeStart;
  const [ey, em, ed] = end.split('-').map(Number);
  const cur = new Date(ey, em - 1, ed);
  const keys: string[] = [];
  for (let i = 0; i < maxDays; i++) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${d}`;
    if (key < start) break;
    keys.push(key);
    cur.setDate(cur.getDate() - 1);
  }
  keys.reverse();
  const days = keys.map((key) => {
    const [yy, mm, dd] = key.split('-').map(Number);
    const dt = new Date(yy, (mm ?? 1) - 1, dd ?? 1);
    const label = dt.toLocaleString(undefined, { month: 'short', day: 'numeric' });
    return { key, label, total: 0 };
  });
  const indexByKey = new Map(days.map((x, i) => [x.key, i] as const));
  for (const e of rows) {
    const day = e.date.slice(0, 10);
    const idx = indexByKey.get(day);
    if (idx !== undefined) days[idx].total += e.amount;
  }
  return days;
}

export function lastNDaysNetByDay(expenses: Expense[], incomes: Income[], n: number) {
  const spend = lastNDaysByDay(expenses, n);
  const incDays = lastNDaysByDay(incomes, n);
  return spend.map((d, i) => ({
    key: d.key,
    label: d.label,
    expense: d.total,
    income: incDays[i]?.total ?? 0,
    net: (incDays[i]?.total ?? 0) - d.total,
  }));
}
