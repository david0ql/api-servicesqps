export interface ShareholderShare {
  name: string;
  percentage: number;
  amount: number;
}

const SHAREHOLDER_MODEL_CHANGE_DATE = '2026-02-16';

export function buildShareholderShares(reportEndDate: string, netProfit: number): ShareholderShare[] {
  const usesNewModel = reportEndDate >= SHAREHOLDER_MODEL_CHANGE_DATE;

  const shareholders = usesNewModel
    ? [
      { name: 'Hugo', percentage: 0.2 },
      { name: 'Felix', percentage: 0.8 },
    ]
    : [
      { name: 'Hugo', percentage: 0.2 },
      { name: 'Felix', percentage: 0.6 },
      { name: 'Felix hijo', percentage: 0.2 },
    ];

  return shareholders.map(shareholder => ({
    ...shareholder,
    amount: netProfit * shareholder.percentage,
  }));
}
