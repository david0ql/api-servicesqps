import moment from 'moment-timezone';

export interface RecurringCostLike {
  description: string;
  amount: string;
  category: string;
  startDate: string;
  endDate: string | null;
}

export interface CostOccurrence {
  date: string;
  description: string;
  amount: string;
  category: string;
}

/** Expande cada costo recurrente en una ocurrencia por semana ISO (lunes a domingo)
 *  del rango en la que este vigente, fechada al cierre de esa semana dentro del rango. */
export function expandRecurringCosts(
  recurringCosts: RecurringCostLike[],
  startDate: string,
  endDate: string,
): CostOccurrence[] {
  const rangeStart = moment.utc(startDate);
  const rangeEnd = moment.utc(endDate);
  const occurrences: CostOccurrence[] = [];

  for (
    let weekStart = rangeStart.clone().startOf('isoWeek');
    weekStart.isSameOrBefore(rangeEnd, 'day');
    weekStart.add(1, 'week')
  ) {
    const weekEnd = weekStart.clone().endOf('isoWeek');
    const periodStart = moment.max(weekStart, rangeStart);
    const periodEnd = moment.min(weekEnd, rangeEnd);

    recurringCosts.forEach(cost => {
      if (moment.utc(cost.startDate).isAfter(periodEnd, 'day')) return;
      if (cost.endDate && moment.utc(cost.endDate).isBefore(periodStart, 'day')) return;

      occurrences.push({
        date: periodEnd.format('YYYY-MM-DD'),
        description: cost.description,
        amount: cost.amount,
        category: cost.category,
      });
    });
  }

  return occurrences;
}
