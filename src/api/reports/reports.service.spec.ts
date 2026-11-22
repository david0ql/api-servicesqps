import { buildShareholderShares } from './shareholder-shares.util';

describe('ReportsService shareholder model by date', () => {
  it('uses 3 shareholders before 2026-02-16', () => {
    const shares = buildShareholderShares('2026-02-15', 1000);

    expect(shares).toEqual([
      { name: 'Hugo', percentage: 0.2, amount: 200, costsAmount: 0 },
      { name: 'Felix', percentage: 0.6, amount: 600, costsAmount: 0 },
      { name: 'Felix hijo', percentage: 0.2, amount: 200, costsAmount: 0 },
    ]);
  });

  it('uses 2 shareholders from 2026-02-16 until 2026-05-31', () => {
    const shares = buildShareholderShares('2026-02-16', 1000);

    expect(shares).toEqual([
      { name: 'Hugo', percentage: 0.2, amount: 200, costsAmount: 0 },
      { name: 'Felix', percentage: 0.8, amount: 800, costsAmount: 0 },
    ]);
  });

  it('uses only Felix (100%) from 2026-06-01 onwards, Diego is no longer a shareholder', () => {
    expect(buildShareholderShares('2026-06-01', 1000)).toEqual([
      { name: 'Felix', percentage: 1, amount: 1000, costsAmount: 0 },
    ]);
    expect(buildShareholderShares('2026-11-22', 1000, 500)).toEqual([
      { name: 'Felix', percentage: 1, amount: 1000, costsAmount: 500 },
    ]);
    expect(buildShareholderShares('2027-01-10', -250, 10).map((s) => s.name)).toEqual(['Felix']);
  });

  it('defaults costs share to 0 when totalCosts is omitted', () => {
    const shares = buildShareholderShares('2026-12-01', 1000);
    expect(shares.every((s) => s.costsAmount === 0)).toBe(true);
  });
});
