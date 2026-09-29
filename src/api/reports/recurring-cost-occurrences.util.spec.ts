import { expandRecurringCosts } from './recurring-cost-occurrences.util';

const weekly = {
  description: 'GoDaddy (email QPS)',
  amount: '2.50',
  category: 'office_expense',
  startDate: '2026-01-01',
  endDate: null,
};

describe('expandRecurringCosts', () => {
  it('counts a recurring cost once in a single ISO week', () => {
    const result = expandRecurringCosts([weekly], '2026-09-21', '2026-09-27');

    expect(result).toEqual([
      { date: '2026-09-27', description: 'GoDaddy (email QPS)', amount: '2.50', category: 'office_expense' },
    ]);
  });

  it('counts one occurrence per week touched by the range', () => {
    const result = expandRecurringCosts([weekly], '2026-09-01', '2026-09-30');

    expect(result.map(r => r.date)).toEqual([
      '2026-09-06',
      '2026-09-13',
      '2026-09-20',
      '2026-09-27',
      '2026-09-30',
    ]);
  });

  it('respects start and end dates of the recurring cost', () => {
    const result = expandRecurringCosts(
      [{ ...weekly, startDate: '2026-09-10', endDate: '2026-09-22' }],
      '2026-09-01',
      '2026-09-30',
    );

    expect(result.map(r => r.date)).toEqual(['2026-09-13', '2026-09-20', '2026-09-27']);
  });

  it('returns nothing when the cost starts after the range', () => {
    expect(expandRecurringCosts([{ ...weekly, startDate: '2026-10-01' }], '2026-09-01', '2026-09-30')).toEqual([]);
  });
});
