import { filterByPeriod, inclusiveCalendarDays } from '../period';

describe('filterByPeriod', () => {
  const items = [
    { date: '2020-01-15', id: 1 },
    { date: '2099-06-01', id: 2 },
  ];

  it('returns all items for period all', () => {
    expect(filterByPeriod(items, 'all')).toHaveLength(2);
  });

  it('filters to month using current calendar month', () => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthItems = [
      { date: `${ym}-05`, id: 1 },
      { date: '2000-01-01', id: 2 },
    ];
    const out = filterByPeriod(monthItems, 'month');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(1);
  });

  it('30d keeps items on or after cutoff', () => {
    const recent = [{ date: '2099-05-06', id: 1 }];
    const old = [{ date: '1999-01-01', id: 2 }];
    const out = filterByPeriod([...recent, ...old], '30d');
    expect(out.map((x) => x.id)).toEqual([1]);
  });

  it('custom filters inclusive date range', () => {
    const rows = [
      { date: '2026-05-01', id: 1 },
      { date: '2026-05-10', id: 2 },
      { date: '2026-06-01', id: 3 },
    ];
    const out = filterByPeriod(rows, 'custom', { start: '2026-05-05', end: '2026-05-31' });
    expect(out.map((x) => x.id)).toEqual([2]);
  });

  it('custom swaps reversed start/end', () => {
    const rows = [{ date: '2026-03-15', id: 1 }];
    const out = filterByPeriod(rows, 'custom', { start: '2026-04-01', end: '2026-03-01' });
    expect(out).toHaveLength(1);
  });

  it('custom with no range returns empty', () => {
    expect(filterByPeriod([{ date: '2026-01-01', id: 1 }], 'custom', null)).toEqual([]);
  });
});

describe('inclusiveCalendarDays', () => {
  it('counts inclusive days', () => {
    expect(inclusiveCalendarDays('2026-05-01', '2026-05-01')).toBe(1);
    expect(inclusiveCalendarDays('2026-05-01', '2026-05-03')).toBe(3);
  });

  it('works when start and end are reversed', () => {
    expect(inclusiveCalendarDays('2026-05-10', '2026-05-01')).toBe(10);
  });
});
