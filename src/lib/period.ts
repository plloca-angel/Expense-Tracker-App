export type PeriodFilter = 'month' | '30d' | 'all' | 'custom';

export type PeriodDateRange = { start: string; end: string };

export function filterByPeriod<T extends { date: string }>(
  items: T[],
  period: PeriodFilter,
  custom?: PeriodDateRange | null
): T[] {
  if (period === 'all') return items;

  if (period === 'custom') {
    if (!custom?.start || !custom?.end) return [];
    const start = custom.start <= custom.end ? custom.start : custom.end;
    const end = custom.start <= custom.end ? custom.end : custom.start;
    return items.filter((i) => {
      const d = i.date.slice(0, 10);
      return d >= start && d <= end;
    });
  }

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

/** Inclusive calendar day count between two YYYY-MM-DD dates (order-independent). */
export function inclusiveCalendarDays(start: string, end: string): number {
  const a = start <= end ? start : end;
  const b = start <= end ? end : start;
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  const u = Date.UTC(y1, m1 - 1, d1);
  const v = Date.UTC(y2, m2 - 1, d2);
  return Math.max(1, Math.floor((v - u) / 86400000) + 1);
}

export function currentMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** ISO date YYYY-MM-DD plus `days` (calendar). */
export function addCalendarDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const t = new Date(y, m - 1, d);
  t.setDate(t.getDate() + days);
  const y2 = t.getFullYear();
  const m2 = String(t.getMonth() + 1).padStart(2, '0');
  const d2 = String(t.getDate()).padStart(2, '0');
  return `${y2}-${m2}-${d2}`;
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
