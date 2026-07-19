import type { Tenancy } from './types.js';

/**
 * Convert a Date to a period key string "YYYY-MM".
 */
export function periodKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Shift a period key forward (+) or backward (−) by N months.
 */
export function shiftPeriod(period: string, months: number): string {
  const [y, m] = period.split('-').map(Number) as [number, number];
  const total = y! * 12 + m! - 1 + months;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, '0')}`;
}

/**
 * Czech month label e.g. "Leden 2026".
 */
const MONTH_LABELS_CZ = [
  'Leden',
  'Únor',
  'Březen',
  'Duben',
  'Květen',
  'Červen',
  'Červenec',
  'Srpen',
  'Září',
  'Říjen',
  'Listopad',
  'Prosinec',
] as const;

export function monthLabel(period: string): string {
  const [y, m] = period.split('-').map(Number) as [number, number];
  const monthName = MONTH_LABELS_CZ[m! - 1];
  return `${monthName} ${y}`;
}

/**
 * Check whether a tenancy is active in the given period "YYYY-MM".
 * A tenancy is active in period P if:
 *   leaseStart ≤ end of P  AND  (leaseEnd is null  OR  leaseEnd ≥ start of P)
 *
 * End of P = last day of the month in P.
 * Start of P = first day of the month in P.
 */
export function isActiveInPeriod(tenancy: Tenancy, period: string): boolean {
  const [py, pm] = period.split('-').map(Number) as [number, number];
  const periodStart = new Date(py!, pm! - 1, 1);
  // Last day of the month: day 0 of next month
  const periodEnd = new Date(py!, pm!, 0);

  const leaseStart = new Date(tenancy.leaseStart + 'T00:00:00');

  // leaseStart must be ≤ end of the period
  if (leaseStart > periodEnd) return false;

  if (tenancy.leaseEnd === null) {
    // Indefinite — active from leaseStart onward
    return leaseStart <= periodEnd;
  }

  const leaseEnd = new Date(tenancy.leaseEnd + 'T00:00:00');
  // leaseEnd must be ≥ start of the period
  return leaseEnd >= periodStart;
}

/**
 * Count how many months of the given year a tenancy was active.
 */
export function activeMonthsInYear(tenancy: Tenancy, year: number): number {
  let count = 0;
  for (let m = 1; m <= 12; m++) {
    const period = `${year}-${String(m).padStart(2, '0')}`;
    if (isActiveInPeriod(tenancy, period)) count++;
  }
  return count;
}

/**
 * Parse a period string "YYYY-MM" and return the first and last Date of that month.
 */
export function periodBoundaries(period: string): { start: Date; end: Date } {
  const [y, m] = period.split('-').map(Number) as [number, number];
  return {
    start: new Date(y!, m! - 1, 1),
    end: new Date(y!, m!, 0, 23, 59, 59, 999),
  };
}