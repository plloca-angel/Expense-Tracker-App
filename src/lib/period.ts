export type PeriodFilter = 'month' | '30d' | 'all';

export function filterByPeriod<T extends { date: string }>(items: T[], period: PeriodFilter): T[] {
  if (period === 'all') return items;

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const ym = `${y}-${String(m + 1).padStart(2, '0')}`;

  if (period === 'month') {
    return items.filter((i) => i.date.slice(0, 7) === ym);
  }

  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 30);
  const cutStr = cutoff.toISOString().slice(0, 10);
  return items.filter((i) => i.date >= cutStr);
}

export function currentMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function expensesInMonth(expenses: { date: string; amount: number; category: string }[], ym: string) {
  return expenses.filter((e) => e.date.slice(0, 7) === ym);
}

export function monthlyTotalsLastNMonths(
  expenses: { date: string; amount: number }[],
  n: number
): { label: string; key: string; total: number }[] {
  const out: { label: string; key: string; total: number }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString(undefined, { month: 'short', year: '2-digit' });
    out.push({ key, label, total: 0 });
  }
  const idx = new Map(out.map((x, i) => [x.key, i] as const));
  for (const e of expenses) {
    const k = e.date.slice(0, 7);
    const j = idx.get(k);
    if (j !== undefined) out[j].total += e.amount;
  }
  return out;
}
