import {
  averageDailySpend,
  spendChangeVsPreviousMonth,
  spendInYearMonth,
  topCategoryShare,
  uniqueDayCount,
} from '../insights';
import type { Expense } from '../../types/expense';

const exp = (partial: Partial<Expense> & Pick<Expense, 'amount' | 'category' | 'date'>): Expense => ({
  id: 1,
  note: null,
  tag: null,
  createdAt: '2026-05-01T00:00:00.000Z',
  ...partial,
});

describe('uniqueDayCount', () => {
  it('counts distinct calendar days', () => {
    expect(uniqueDayCount(['2026-05-01', '2026-05-01', '2026-05-02'])).toBe(2);
  });
});

describe('averageDailySpend', () => {
  it('returns 0 when no expenses in period', () => {
    expect(averageDailySpend([], 'all')).toBe(0);
  });

  it('uses 30 days for 30d period', () => {
    const list = [exp({ amount: 300, category: 'A', date: '2026-05-05', id: 1 })];
    expect(averageDailySpend(list, '30d')).toBe(10);
  });
});

describe('spendInYearMonth', () => {
  it('sums amounts for YYYY-MM', () => {
    const list = [
      exp({ amount: 10, category: 'A', date: '2026-04-30', id: 1 }),
      exp({ amount: 20, category: 'B', date: '2026-05-01', id: 2 }),
    ];
    expect(spendInYearMonth(list, '2026-05')).toBe(20);
  });
});

describe('spendChangeVsPreviousMonth', () => {
  it('computes percent change vs previous month', () => {
    const list = [
      exp({ amount: 100, category: 'A', date: '2026-04-15', id: 1 }),
      exp({ amount: 150, category: 'A', date: '2026-05-10', id: 2 }),
    ];
    const r = spendChangeVsPreviousMonth(list, '2026-05');
    expect(r.previous).toBe(100);
    expect(r.current).toBe(150);
    expect(r.pctChange).toBeCloseTo(50);
  });

  it('returns null pct when previous is zero', () => {
    const list = [exp({ amount: 50, category: 'A', date: '2026-05-01', id: 1 })];
    const r = spendChangeVsPreviousMonth(list, '2026-05');
    expect(r.pctChange).toBeNull();
  });
});

describe('topCategoryShare', () => {
  it('returns null when no spend', () => {
    expect(topCategoryShare([], 'all')).toBeNull();
  });

  it('returns dominant category share', () => {
    const list = [
      exp({ amount: 75, category: 'Food', date: '2026-05-01', id: 1 }),
      exp({ amount: 25, category: 'Other', date: '2026-05-02', id: 2 }),
    ];
    const r = topCategoryShare(list, 'all');
    expect(r).toEqual({ category: 'Food', share: 0.75 });
  });
});
