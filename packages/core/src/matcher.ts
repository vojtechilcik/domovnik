import type { MatchResult, ParsedStatementRow, Payment, Tenancy } from './types.js';

/**
 * Reconciliation matcher.
 * Given a parsed credit row + existing tenancies + existing payments,
 * classify the row as:
 *   - 'match'        — VS found, amount equals rent + services for the matched tenancy
 *   - 'amount_mismatch' — VS found, but amount differs from expected
 *   - 'duplicate'    — VS found and a payment for this period already exists
 *   - 'nomatch'      — VS unknown (or empty)
 */
export function matchRow(
  row: ParsedStatementRow,
  tenancies: Tenancy[],
  existingPayments: Payment[],
): MatchResult {
  const vs = row.vs?.trim() ?? '';
  const period = row.period;
  const amount = row.amount;

  // No VS → nomatch immediately
  if (!vs) {
    return {
      row,
      classification: 'nomatch',
      tenancyId: null,
      expectedAmount: null,
      existingPaymentId: null,
      reason: 'Žádný variabilní symbol',
    };
  }

  // Find tenancy by VS
  const tenancy = tenancies.find((t) => t.variableSymbol === vs);

  if (!tenancy) {
    return {
      row,
      classification: 'nomatch',
      tenancyId: null,
      expectedAmount: null,
      existingPaymentId: null,
      reason: `Variabilní symbol ${vs} nenalezen mezi nájemníky`,
    };
  }

  const expectedAmount = tenancy.rent + tenancy.serviceAdvances;

  // Check for duplicate — same tenancy + same period already paid
  const existingPayment = existingPayments.find(
    (p) => p.tenancyId === tenancy.id && p.period === period,
  );

  if (existingPayment) {
    return {
      row,
      classification: 'duplicate',
      tenancyId: tenancy.id,
      expectedAmount,
      existingPaymentId: existingPayment.id,
      reason: `Období ${period} je již spárováno (platba ${existingPayment.id})`,
    };
  }

  // Check amount match
  if (amount === expectedAmount) {
    return {
      row,
      classification: 'match',
      tenancyId: tenancy.id,
      expectedAmount,
      existingPaymentId: null,
      reason: `Částka sedí: ${amount} = ${expectedAmount}`,
    };
  }

  // Amount mismatch
  return {
    row,
    classification: 'amount_mismatch',
    tenancyId: tenancy.id,
    expectedAmount,
    existingPaymentId: null,
    reason: `Částka nesouhlasí: očekáváno ${expectedAmount}, přijato ${amount}`,
  };
}

/**
 * Batch matcher: match all rows against tenancies and existing payments.
 * Returns MatchResult[] sorted by classification priority:
 *   match > amount_mismatch > duplicate > nomatch
 */
export function matchStatement(
  rows: ParsedStatementRow[],
  tenancies: Tenancy[],
  existingPayments: Payment[],
): MatchResult[] {
  const results = rows.map((row) => matchRow(row, tenancies, existingPayments));

  // Sort: match first, nomatch last
  const order: Record<string, number> = {
    match: 0,
    amount_mismatch: 1,
    duplicate: 2,
    nomatch: 3,
  };

  return results.sort((a, b) => {
    const oa = order[a.classification] ?? 99;
    const ob = order[b.classification] ?? 99;
    return oa - ob;
  });
}

/**
 * Get preselected matches — only exact matches should be preselected for booking.
 */
export function getPreselected(results: MatchResult[]): MatchResult[] {
  return results.filter((r) => r.classification === 'match');
}