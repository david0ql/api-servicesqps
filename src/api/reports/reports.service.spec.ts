import { buildShareholderShares } from './shareholder-shares.util';

describe('ReportsService shareholder model by date', () => {
  it('uses 3 shareholders before 2026-02-16', () => {
    const shares = buildShareholderShares('2026-02-15', 1000);

    expect(shares).toEqual([
      { name: 'Hugo', percentage: 0.2, amount: 200 },
      { name: 'Felix', percentage: 0.6, amount: 600 },
      { name: 'Felix hijo', percentage: 0.2, amount: 200 },
    ]);
  });

  it('uses 2 shareholders from 2026-02-16 until 2026-05-31', () => {
    const shares = buildShareholderShares('2026-02-16', 1000);

    expect(shares).toEqual([
      { name: 'Hugo', percentage: 0.2, amount: 200 },
      { name: 'Felix', percentage: 0.8, amount: 800 },
    ]);
  });

  it('uses only Felix from 2026-06-01 onwards', () => {
    const shares = buildShareholderShares('2026-06-01', 1000);

    expect(shares).toEqual([
      { name: 'Felix', percentage: 1, amount: 1000 },
    ]);
  });
});
