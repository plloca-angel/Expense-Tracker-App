import type { RecurringFrequency } from '../types/recurring';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function parseISODate(iso: string): { y: number; m: number; d: number } {
  const [ys, ms, ds] = iso.slice(0, 10).split('-');
  return { y: Number(ys), m: Number(ms), d: Number(ds) };
}

/** Next calendar date strictly after `from` (YYYY-MM-DD) matching day-of-month, clamped to month end. */
export function nextMonthlyOccurrence(from: string, dayOfMonth: number): string {
  const { y, m, d } = parseISODate(from);
  const start = new Date(y, m - 1, d);
  start.setDate(start.getDate() + 1);
  const target = Math.min(Math.max(1, dayOfMonth), 31);
  let y2 = start.getFullYear();
  let m2 = start.getMonth();
  const lastDay = new Date(y2, m2 + 1, 0).getDate();
  const useDay = Math.min(target, lastDay);
  return `${y2}-${pad2(m2 + 1)}-${pad2(useDay)}`;
}

/** Next weekly occurrence on `weekday` (0 Sun … 6 Sat) strictly after `from`. */
export function nextWeeklyOccurrence(from: string, weekday: number): string {
  const { y, m, d } = parseISODate(from);
  const cur = new Date(y, m - 1, d);
  for (let i = 1; i <= 7; i++) {
    const t = new Date(cur);
    t.setDate(t.getDate() + i);
    if (t.getDay() === weekday) {
      return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
    }
  }
  return from;
}

export function advanceRecurringDue(
  frequency: RecurringFrequency,
  fromDue: string,
  dayOfMonth: number | null,
  weekday: number | null
): string {
  if (frequency === 'monthly') {
    const dom = dayOfMonth ?? parseISODate(fromDue).d;
    return nextMonthlyOccurrence(fromDue, dom);
  }
  const wd = weekday ?? new Date().getDay();
  return nextWeeklyOccurrence(fromDue, wd);
}
