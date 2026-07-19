import type { SettlementCostItem, SettlementResult } from './types.js';

/**
 * Settlement calculator: advancesTotal − Σcosts → { result, kind }
 * result ≥ 0 → "přeplatek" (overpayment, landlord returns to tenant)
 * result < 0 → "nedoplatek" (underpayment, tenant owes landlord)
 */
export function calculateSettlement(
  advancesTotal: number,
  costs: SettlementCostItem[],
): SettlementResult {
  const costsTotal = costs.reduce((sum, item) => sum + item.amount, 0);
  const result = advancesTotal - costsTotal;

  return {
    advancesTotal,
    costsTotal,
    result,
    kind: result >= 0 ? 'přeplatek' : 'nedoplatek',
  };
}

/**
 * Compute advances from records helper:
 * active months in the given year × monthly serviceAdvances.
 */
export function computeAdvancesFromRecords(
  activeMonths: number,
  monthlyServiceAdvances: number,
): number {
  return activeMonths * monthlyServiceAdvances;
}