export interface ShareholderShare {
  name: string;
  percentage: number;
  /** Parte de la ganancia neta que le corresponde al accionista. */
  amount: number;
  /** Parte de los gastos (costos) de la semana que asume el accionista. */
  costsAmount: number;
}

const TWO_SHAREHOLDERS_MODEL_CHANGE_DATE = '2026-02-16';
const FELIX_ONLY_MODEL_CHANGE_DATE = '2026-06-01';
/** Desde esta fecha (fin de semana del reporte) Diego entra con el 20% de ganancias y gastos. */
export const DIEGO_SHAREHOLDER_START_DATE = '2026-11-16';

interface ShareholderTranche {
  from: string;
  shareholders: { name: string; percentage: number }[];
}

// Ordenados de la fecha mas reciente a la mas antigua: gana el primero cuyo
// `from` sea <= a la fecha de fin del reporte.
const SHAREHOLDER_TRANCHES: ShareholderTranche[] = [
  {
    from: DIEGO_SHAREHOLDER_START_DATE,
    shareholders: [
      { name: 'Felix', percentage: 0.8 },
      { name: 'Diego', percentage: 0.2 },
    ],
  },
  {
    from: FELIX_ONLY_MODEL_CHANGE_DATE,
    shareholders: [{ name: 'Felix', percentage: 1 }],
  },
  {
    from: TWO_SHAREHOLDERS_MODEL_CHANGE_DATE,
    shareholders: [
      { name: 'Hugo', percentage: 0.2 },
      { name: 'Felix', percentage: 0.8 },
    ],
  },
  {
    from: '',
    shareholders: [
      { name: 'Hugo', percentage: 0.2 },
      { name: 'Felix', percentage: 0.6 },
      { name: 'Felix hijo', percentage: 0.2 },
    ],
  },
];

export function buildShareholderShares(
  reportEndDate: string,
  netProfit: number,
  totalCosts = 0,
): ShareholderShare[] {
  const tranche = SHAREHOLDER_TRANCHES.find((t) => reportEndDate >= t.from)
    ?? SHAREHOLDER_TRANCHES[SHAREHOLDER_TRANCHES.length - 1];

  return tranche.shareholders.map((shareholder) => ({
    ...shareholder,
    amount: netProfit * shareholder.percentage,
    costsAmount: totalCosts * shareholder.percentage,
  }));
}
