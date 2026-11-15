import { buildShareholderShares, DIEGO_SHAREHOLDER_START_DATE } from './shareholder-shares.util';

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

  it('uses only Felix from 2026-06-01 until the day before Diego joins', () => {
    expect(buildShareholderShares('2026-06-01', 1000)).toEqual([
      { name: 'Felix', percentage: 1, amount: 1000, costsAmount: 0 },
    ]);
    expect(buildShareholderShares('2026-11-15', 1000, 500)).toEqual([
      { name: 'Felix', percentage: 1, amount: 1000, costsAmount: 500 },
    ]);
  });

  it('splits Felix 80% / Diego 20% of profit and costs from 2026-11-16', () => {
    expect(DIEGO_SHAREHOLDER_START_DATE).toBe('2026-11-16');

    const shares = buildShareholderShares('2026-11-16', 1000, 500);

    expect(shares).toEqual([
      { name: 'Felix', percentage: 0.8, amount: 800, costsAmount: 400 },
      { name: 'Diego', percentage: 0.2, amount: 200, costsAmount: 100 },
    ]);
  });

  it('keeps the Diego split for later weeks and totals add up', () => {
    const shares = buildShareholderShares('2027-01-10', -250, 1234.5);
    const diego = shares.find((s) => s.name === 'Diego');

    expect(diego.amount).toBeCloseTo(-50);
    expect(diego.costsAmount).toBeCloseTo(246.9);
    expect(shares.reduce((sum, s) => sum + s.percentage, 0)).toBeCloseTo(1);
    expect(shares.reduce((sum, s) => sum + s.costsAmount, 0)).toBeCloseTo(1234.5);
  });

  it('defaults costs share to 0 when totalCosts is omitted', () => {
    const shares = buildShareholderShares('2026-12-01', 1000);
    expect(shares.every((s) => s.costsAmount === 0)).toBe(true);
  });
});
