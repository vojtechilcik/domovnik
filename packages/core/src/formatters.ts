/**
 * Czech locale formatters (cs-CZ).
 *
 * - Number: space as thousands separator, comma as decimal.
 * - Currency: "21 700 Kč", "218 056,00" — but should use Intl.NumberFormat("cs-CZ")
 *   which ships in modern Node and browsers. For Android Hermes we note the ICU data
 *   must be shipped separately (see master spec §8).
 * - Date: "d. M. yyyy" format.
 */

/**
 * Format a number with Czech thousands separator (space) and decimal separator (comma).
 * Example: 21700 → "21 700", 218056.50 → "218 056,5" (or "218 056,50" if fraction digits set)
 */
export function formatNumber(n: number, fractionDigits?: number): string {
  if (typeof Intl !== 'undefined') {
    try {
      return new Intl.NumberFormat('cs-CZ', {
        minimumFractionDigits: fractionDigits ?? 0,
        maximumFractionDigits: fractionDigits ?? 2,
      }).format(n);
    } catch {
      // Fallback below
    }
  }
  return fallbackFormat(n, fractionDigits);
}

function fallbackFormat(n: number, fd?: number): string {
  const fixed = n.toFixed(fd ?? 2);
  const [intPart, decPart] = fixed.split('.');
  const spaced = intPart!.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decPart ? `${spaced},${decPart}` : spaced;
}

/**
 * Format a monetary value in CZK.
 * Example: czk(21700) → "21 700 Kč", czk(218056.45) → "218 056,45 Kč"
 */
export function czk(n: number): string {
  const formatted = formatNumber(n, 2);
  return `${formatted} Kč`;
}

/**
 * Format an integer amount in CZK (no decimals, e.g. rent).
 * Example: czkInt(21700) → "21 700 Kč"
 */
export function czkInt(n: number): string {
  const formatted = formatNumber(n, 0);
  return `${formatted} Kč`;
}

/**
 * Format a date as "d. M. yyyy" (Czech convention — no leading zeros for day).
 * Example: new Date("2026-07-05") → "5. 7. 2026"
 */
export function formatDate(d: Date): string {
  if (typeof Intl !== 'undefined') {
    try {
      return new Intl.DateTimeFormat('cs-CZ', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      }).format(d);
    } catch {
      // Fallback below
    }
  }
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

/**
 * Format an ISO date string to Czech "d. M. yyyy".
 */
export function formatIsoDate(iso: string): string {
  return formatDate(new Date(iso + 'T00:00:00'));
}

/**
 * Format a period "YYYY-MM" to a human-readable Czech month label.
 * Example: "2026-07" → "Červenec 2026"
 */
export function formatPeriod(period: string): string {
  const MONTHS = [
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
  ];
  const [y, m] = period.split('-').map(Number) as [number, number];
  return `${MONTHS[m! - 1]} ${y}`;
}

/**
 * Format a percentage change e.g. "2,8 %".
 */
export function formatPercent(n: number): string {
  const formatted = formatNumber(n, 1);
  return `${formatted} %`;
}