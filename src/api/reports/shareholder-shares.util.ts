export interface ShareholderShare {
  name: string;
  percentage: number;
  amount: number;
}

const TWO_SHAREHOLDERS_MODEL_CHANGE_DATE = '2026-02-16';
const FELIX_ONLY_MODEL_CHANGE_DATE = '2026-06-01';

export function buildShareholderShares(reportEndDate: string, netProfit: number): ShareholderShare[] {
  const usesFelixOnlyModel = reportEndDate >= FELIX_ONLY_MODEL_CHANGE_DATE;
  const usesTwoShareholdersModel = reportEndDate >= TWO_SHAREHOLDERS_MODEL_CHANGE_DATE;

  const shareholders = usesFelixOnlyModel
    ? [
      { name: 'Felix', percentage: 1 },
    ]
    : usesTwoShareholdersModel
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
