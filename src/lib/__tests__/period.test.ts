import { filterByPeriod } from '../period';

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
});
