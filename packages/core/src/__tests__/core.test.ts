import { describe, it, expect } from 'vitest';
import {
  // Types
  type Tenancy,
  type Payment,
  type ParsedStatementRow,
  type SettlementCostItem,
  // Schemas
  triageResultSchema,
  draftActionsResultSchema,
  // Period math
  periodKey,
  shiftPeriod,
  monthLabel,
  isActiveInPeriod,
  activeMonthsInYear,
  // Statement parser
  parseCzechAmount,
  parseCzechDate,
  detectDelimiter,
  splitCsvLine,
  detectColumns,
  parseCsvStatement,
  parseGpcAbo,
  parseStatement,
  // Matcher
  matchRow,
  matchStatement,
  getPreselected,
  // Settlement
  calculateSettlement,
  computeAdvancesFromRecords,
  // Formatters
  formatNumber,
  czk,
  czkInt,
  formatDate,
  formatIsoDate,
  formatPeriod,
  formatPercent,
} from '../index.js';

// ============================================================================
// Schema validation tests
// ============================================================================

describe('triageResultSchema', () => {
  const validTriage = {
    kategorie: 'Voda a odpad',
    nalehavost: 'havárie',
    bezpecnost: { riziko: true, poznamka: 'Hrozí úraz elektrickým proudem' },
    odpovednost: { strana: 'pronajímatel', duvod: 'Jedná se o hlavní rozvod vody' },
    shrnuti: 'Prasklá hadička k pračce, na podlaze je voda.',
    doporuceny_remeslnik: 'Instalatér — havarijní služba',
    doporucene_kroky: ['Zavřít hlavní přívod vody', 'Odpojit pračku ze zásuvky'],
    doplnujici_otazky: ['Je poškozená i podlaha?'],
    odhad_nakladu: '2 000–5 000 Kč',
  };

  it('accepts a valid triage result', () => {
    const result = triageResultSchema.safeParse(validTriage);
    expect(result.success).toBe(true);
  });

  it('rejects when nalehavost has an invalid value', () => {
    const result = triageResultSchema.safeParse({ ...validTriage, nalehavost: 'kritická' });
    expect(result.success).toBe(false);
  });

  it('rejects when odpovednost.strana is invalid', () => {
    const result = triageResultSchema.safeParse({
      ...validTriage,
      odpovednost: { strana: 'soused', duvod: 'test' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts null bezpecnost.poznamka and odhad_nakladu', () => {
    const minimal = {
      ...validTriage,
      bezpecnost: { riziko: false, poznamka: null },
      odhad_nakladu: null,
    };
    const result = triageResultSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });
});

describe('draftActionsResultSchema', () => {
  it('accepts a valid draft actions result', () => {
    const result = draftActionsResultSchema.safeParse({
      zprava_najemnikovi: 'Dobrý den, závadu jsme přijali.',
      poptavka_remeslnikovi: 'Prosím o opravu v bytě 2+kk, adresa...',
      doporuceny_stav: 'Nová',
      potreba_doplnit: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects when doporuceny_stav is invalid', () => {
    const result = draftActionsResultSchema.safeParse({
      zprava_najemnikovi: 'test',
      poptavka_remeslnikovi: 'test',
      doporuceny_stav: 'Neexistující',
      potreba_doplnit: false,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Period math tests
// ============================================================================

describe('periodKey', () => {
  it('formats January as YYYY-01', () => {
    expect(periodKey(new Date(2026, 0, 5))).toBe('2026-01');
  });
  it('formats December as YYYY-12', () => {
    expect(periodKey(new Date(2026, 11, 25))).toBe('2026-12');
  });
  it('formats July correctly', () => {
    expect(periodKey(new Date(2026, 6, 9))).toBe('2026-07');
  });
});

describe('shiftPeriod', () => {
  it('shifts forward by 1 month', () => {
    expect(shiftPeriod('2026-01', 1)).toBe('2026-02');
  });
  it('wraps year forward', () => {
    expect(shiftPeriod('2026-12', 1)).toBe('2027-01');
  });
  it('shifts backward by 1 month', () => {
    expect(shiftPeriod('2026-01', -1)).toBe('2025-12');
  });
  it('shifts by 3 months', () => {
    expect(shiftPeriod('2026-03', 3)).toBe('2026-06');
  });
});

describe('monthLabel', () => {
  it('returns Czech month label', () => {
    expect(monthLabel('2026-07')).toBe('Červenec 2026');
  });
  it('handles January', () => {
    expect(monthLabel('2026-01')).toBe('Leden 2026');
  });
  it('handles December', () => {
    expect(monthLabel('2026-12')).toBe('Prosinec 2026');
  });
});

describe('isActiveInPeriod', () => {
  const indefiniteTenancy: Tenancy = {
    id: 't1',
    landlordId: 'l1',
    unitId: 'u1',
    tenantUserId: null,
    tenantName: 'Petra Nováková',
    phone: null,
    email: null,
    rent: 20000,
    serviceAdvances: 1700,
    deposit: null,
    variableSymbol: '1201',
    leaseStart: '2026-01-01',
    leaseEnd: null,
    createdAt: '',
    updatedAt: '',
  };

  const fixedTenancy: Tenancy = {
    ...indefiniteTenancy,
    id: 't2',
    variableSymbol: '3304',
    leaseStart: '2026-03-01',
    leaseEnd: '2026-06-30',
  };

  it('indefinite tenancy is active for all months after lease start', () => {
    expect(isActiveInPeriod(indefiniteTenancy, '2026-01')).toBe(true);
    expect(isActiveInPeriod(indefiniteTenancy, '2026-07')).toBe(true);
    expect(isActiveInPeriod(indefiniteTenancy, '2026-12')).toBe(true);
    // Before lease start
    expect(isActiveInPeriod(indefiniteTenancy, '2025-12')).toBe(false);
  });

  it('fixed tenancy is active only within lease period', () => {
    expect(isActiveInPeriod(fixedTenancy, '2026-02')).toBe(false); // before
    expect(isActiveInPeriod(fixedTenancy, '2026-03')).toBe(true); // first month
    expect(isActiveInPeriod(fixedTenancy, '2026-05')).toBe(true); // middle
    expect(isActiveInPeriod(fixedTenancy, '2026-06')).toBe(true); // last month
    expect(isActiveInPeriod(fixedTenancy, '2026-07')).toBe(false); // after
  });

  it('tenancy ending mid-year is false after leaseEnd', () => {
    // Lease ends June 30 — July should be inactive
    expect(isActiveInPeriod(fixedTenancy, '2026-07')).toBe(false);
  });

  it('tenancy starting mid-year is false before leaseStart', () => {
    expect(isActiveInPeriod(fixedTenancy, '2026-01')).toBe(false);
  });
});

describe('activeMonthsInYear', () => {
  const tenancy: Tenancy = {
    id: 't3',
    landlordId: 'l1',
    unitId: 'u1',
    tenantUserId: null,
    tenantName: 'Test',
    phone: null,
    email: null,
    rent: 10000,
    serviceAdvances: 500,
    deposit: null,
    variableSymbol: '5555',
    leaseStart: '2026-04-01',
    leaseEnd: '2026-09-30',
    createdAt: '',
    updatedAt: '',
  };

  it('counts active months correctly (Apr–Sep = 6)', () => {
    expect(activeMonthsInYear(tenancy, 2026)).toBe(6);
  });

  it('indefinite tenancy counts 12 for full year', () => {
    const indefinite: Tenancy = { ...tenancy, leaseStart: '2025-06-01', leaseEnd: null };
    expect(activeMonthsInYear(indefinite, 2026)).toBe(12);
  });
});

// ============================================================================
// Statement parser tests
// ============================================================================

describe('parseCzechAmount', () => {
  it('parses "21 700,00" → 21700', () => {
    expect(parseCzechAmount('21 700,00')).toBe(21700);
  });
  it('parses "1 500,50" → 1500.50', () => {
    expect(parseCzechAmount('1 500,50')).toBe(1500.5);
  });
  it('parses "42 350,00" → 42350', () => {
    expect(parseCzechAmount('42 350,00')).toBe(42350);
  });
  it('parses plain integer "1200" → 1200', () => {
    expect(parseCzechAmount('1200')).toBe(1200);
  });
  it('parses huge number "218 056,00" → 218056', () => {
    expect(parseCzechAmount('218 056,00')).toBe(218056);
  });
});

describe('parseCzechDate', () => {
  it('parses "5. 7. 2026" → 2026-07-05', () => {
    expect(parseCzechDate('5. 7. 2026')).toBe('2026-07-05');
  });
  it('parses "11. 7. 2026" → 2026-07-11', () => {
    expect(parseCzechDate('11. 7. 2026')).toBe('2026-07-11');
  });
  it('passes through ISO date "2026-07-05"', () => {
    expect(parseCzechDate('2026-07-05')).toBe('2026-07-05');
  });
  it('rejects invalid date', () => {
    expect(() => parseCzechDate('not-a-date')).toThrow();
  });
});

describe('detectDelimiter', () => {
  it('detects semicolon when present', () => {
    expect(detectDelimiter('Datum;Objem;VS;Protiúčet;Zpráva')).toBe(';');
  });
  it('detects comma when present', () => {
    expect(detectDelimiter('Datum,Objem,VS,Protiúčet,Zpráva')).toBe(',');
  });
});

describe('splitCsvLine', () => {
  it('splits on semicolon', () => {
    expect(splitCsvLine('a;b;c', ';')).toEqual(['a', 'b', 'c']);
  });
  it('respects quoted fields', () => {
    expect(splitCsvLine('a;"b;c";d', ';')).toEqual(['a', 'b;c', 'd']);
  });
});

describe('detectColumns', () => {
  it('finds standard Czech CSV headers (semicolon)', () => {
    const cols = detectColumns(['Datum', 'Objem', 'VS', 'Název protiúčtu', 'Zpráva pro příjemce']);
    expect(cols.dateIdx).toBe(0);
    expect(cols.amountIdx).toBe(1);
    expect(cols.vsIdx).toBe(2);
    expect(cols.counterpartyIdx).toBe(3);
    expect(cols.messageIdx).toBe(4);
  });

  it('finds standard Czech CSV headers (comma)', () => {
    const cols = detectColumns(['Datum', 'Objem', 'VS', 'Název protiúčtu', 'Zpráva']);
    expect(cols.dateIdx).toBe(0);
    expect(cols.amountIdx).toBe(1);
    expect(cols.vsIdx).toBe(2);
    expect(cols.counterpartyIdx).toBe(3);
    expect(cols.messageIdx).toBe(4);
  });
});

describe('parseCsvStatement — exact fixture from spec', () => {
  const fixture = `Datum;Objem;VS;Název protiúčtu;Zpráva pro příjemce
5. 7. 2026;21 700,00;1201;Petra Nováková;najem cervenec
6. 7. 2026;15 900,00;3304;Tereza Horáková;najemne + sluzby cervenec
7. 7. 2026;28 100,00;8802;Martin Dvořák;najem 07/2026
9. 7. 2026;42 350,00;;Zaměstnavatel s.r.o.;mzda 06/2026
11. 7. 2026;12 000,00;9910;Neznámý odesílatel;vratka`;

  it('parses 5 rows from the fixture', () => {
    const rows = parseCsvStatement(fixture);
    expect(rows).toHaveLength(5);
  });

  it('correctly parses first tenant credit (VS 1201, 21 700 Kč)', () => {
    const rows = parseCsvStatement(fixture);
    const row = rows[0]!;
    expect(row.date).toBe('2026-07-05');
    expect(row.period).toBe('2026-07');
    expect(row.amount).toBe(21700);
    expect(row.vs).toBe('1201');
    expect(row.counterparty).toBe('Petra Nováková');
    expect(row.message).toBe('najem cervenec');
  });

  it('correctly parses second tenant credit (VS 3304, 15 900 Kč)', () => {
    const rows = parseCsvStatement(fixture);
    const row = rows[1]!;
    expect(row.amount).toBe(15900);
    expect(row.vs).toBe('3304');
    expect(row.counterparty).toBe('Tereza Horáková');
  });

  it('correctly parses third tenant credit (VS 8802, 28 100 Kč)', () => {
    const rows = parseCsvStatement(fixture);
    const row = rows[2]!;
    expect(row.amount).toBe(28100);
    expect(row.vs).toBe('8802');
    expect(row.counterparty).toBe('Martin Dvořák');
  });

  it('correctly parses salary credit (no VS, 42 350 Kč)', () => {
    const rows = parseCsvStatement(fixture);
    const row = rows[3]!;
    expect(row.amount).toBe(42350);
    expect(row.vs).toBeNull();
    expect(row.counterparty).toBe('Zaměstnavatel s.r.o.');
  });

  it('correctly parses unknown sender (VS 9910, 12 000 Kč)', () => {
    const rows = parseCsvStatement(fixture);
    const row = rows[4]!;
    expect(row.amount).toBe(12000);
    expect(row.vs).toBe('9910');
    expect(row.counterparty).toBe('Neznámý odesílatel');
  });

  it('asserts 3 tenant-matching credits + 2 non-matches by VS', () => {
    const rows = parseCsvStatement(fixture);
    const matchingVs = rows.filter((r) => ['1201', '3304', '8802'].includes(r.vs ?? ''));
    const nonMatching = rows.filter((r) => r.vs === null || !['1201', '3304', '8802'].includes(r.vs));
    expect(matchingVs).toHaveLength(3);
    expect(nonMatching).toHaveLength(2);
  });
});

describe('parseGpcAbo', () => {
  it('parses a simple GPC transaction line (fixed-width)', () => {
    // Build a minimal GPC-like line with known date and amount fields
    // Positions: date(59-64 DDMMYY), amount(40-53 in halere), vs(54-63)
    let line = ' '.repeat(200);
    // Amount: 2170000 (halere of 21700) at cols 40-53 (14 chars right-aligned)
    const amtStr = '00000002170000'; // 14 chars, 21700.00 CZK
    line = line.substring(0, 40) + amtStr + line.substring(54);
    // Date: 050726 (5.7.2026) at cols 59-64
    const dateStr = '050726';
    line = line.substring(0, 59) + dateStr + line.substring(65);
    // VS: 1201 at cols 54-63
    const vsStr = '0000001201';
    line = line.substring(0, 54) + vsStr + line.substring(64);

    const rows = parseGpcAbo(line);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.amount).toBe(21700);
    expect(rows[0]!.date).toBe('2026-07-05');
    expect(rows[0]!.vs).toBe('1201');
  });

  it('returns empty array for lines too short', () => {
    expect(parseGpcAbo('short')).toEqual([]);
  });
});

describe('parseStatement (unified)', () => {
  it('delegates to CSV parser when header contains "Datum"', () => {
    const csv = 'Datum;Objem;VS;Protiúčet;Zpráva\n5. 7. 2026;1 000,00;1234;Test;test';
    const rows = parseStatement(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.vs).toBe('1234');
  });

  it('falls back to GPC parser for non-CSV content', () => {
    // Non-CSV content triggers GPC fallback (should return empty if no valid GPC rows)
    const garbage = 'this is some random text\nwith no CSV structure\nanother line';
    const rows = parseStatement(garbage);
    // No valid GPC records — should return empty
    expect(rows).toEqual([]);
  });
});

// ============================================================================
// Reconciliation matcher tests
// ============================================================================

describe('matchRow', () => {
  const tenancy: Tenancy = {
    id: 't-1201',
    landlordId: 'l1',
    unitId: 'u1',
    tenantUserId: null,
    tenantName: 'Petra Nováková',
    phone: null,
    email: null,
    rent: 20000,
    serviceAdvances: 1700,
    deposit: null,
    variableSymbol: '1201',
    leaseStart: '2026-01-01',
    leaseEnd: null,
    createdAt: '',
    updatedAt: '',
  };

  const tenancies = [tenancy];
  const noPayments: Payment[] = [];

  it('classifies as match when VS found and amount equals rent+services', () => {
    const row: ParsedStatementRow = {
      date: '2026-07-05',
      period: '2026-07',
      amount: 21700, // 20000 + 1700
      vs: '1201',
      counterparty: 'Petra Nováková',
      message: 'najem',
      rawLine: '',
    };
    const result = matchRow(row, tenancies, noPayments);
    expect(result.classification).toBe('match');
    expect(result.tenancyId).toBe('t-1201');
    expect(result.expectedAmount).toBe(21700);
    expect(result.reason).toContain('Částka sedí');
  });

  it('classifies as amount_mismatch when VS found but amount differs', () => {
    const row: ParsedStatementRow = {
      date: '2026-07-06',
      period: '2026-07',
      amount: 15000,
      vs: '1201',
      counterparty: 'Petra Nováková',
      message: 'najem',
      rawLine: '',
    };
    const result = matchRow(row, tenancies, noPayments);
    expect(result.classification).toBe('amount_mismatch');
    expect(result.tenancyId).toBe('t-1201');
    expect(result.expectedAmount).toBe(21700);
    expect(result.reason).toContain('Částka nesouhlasí');
  });

  it('classifies as nomatch when VS is empty', () => {
    const row: ParsedStatementRow = {
      date: '2026-07-09',
      period: '2026-07',
      amount: 42350,
      vs: null,
      counterparty: 'Zaměstnavatel s.r.o.',
      message: 'mzda',
      rawLine: '',
    };
    const result = matchRow(row, tenancies, noPayments);
    expect(result.classification).toBe('nomatch');
    expect(result.tenancyId).toBeNull();
  });

  it('classifies as nomatch when VS is unknown', () => {
    const row: ParsedStatementRow = {
      date: '2026-07-11',
      period: '2026-07',
      amount: 12000,
      vs: '9910',
      counterparty: 'Neznámý odesílatel',
      message: 'vratka',
      rawLine: '',
    };
    const result = matchRow(row, tenancies, noPayments);
    expect(result.classification).toBe('nomatch');
    expect(result.reason).toContain('9910');
  });

  it('classifies as duplicate when same tenancy+period already paid', () => {
    const existingPayment: Payment = {
      id: 'p-1',
      landlordId: 'l1',
      tenancyId: 't-1201',
      period: '2026-07',
      amount: 21700,
      paidDate: '2026-07-05',
      method: 'Bankovní výpis',
      sourceMetadata: null,
      createdAt: '',
      updatedAt: '',
    };
    const row: ParsedStatementRow = {
      date: '2026-07-20',
      period: '2026-07',
      amount: 21700,
      vs: '1201',
      counterparty: 'Petra Nováková',
      message: 'najem znovu',
      rawLine: '',
    };
    const result = matchRow(row, tenancies, [existingPayment]);
    expect(result.classification).toBe('duplicate');
    expect(result.existingPaymentId).toBe('p-1');
    expect(result.reason).toContain('již spárováno');
  });
});

describe('matchStatement & getPreselected', () => {
  const tenancies: Tenancy[] = [
    {
      id: 't-1201',
      landlordId: 'l1',
      unitId: 'u1',
      tenantUserId: null,
      tenantName: 'Petra Nováková',
      phone: null,
      email: null,
      rent: 20000,
      serviceAdvances: 1700,
      deposit: null,
      variableSymbol: '1201',
      leaseStart: '2026-01-01',
      leaseEnd: null,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 't-3304',
      landlordId: 'l1',
      unitId: 'u2',
      tenantUserId: null,
      tenantName: 'Tereza Horáková',
      phone: null,
      email: null,
      rent: 13900,
      serviceAdvances: 2000,
      deposit: null,
      variableSymbol: '3304',
      leaseStart: '2026-01-01',
      leaseEnd: null,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 't-8802',
      landlordId: 'l1',
      unitId: 'u3',
      tenantUserId: null,
      tenantName: 'Martin Dvořák',
      phone: null,
      email: null,
      rent: 26100,
      serviceAdvances: 2000,
      deposit: null,
      variableSymbol: '8802',
      leaseStart: '2026-01-01',
      leaseEnd: null,
      createdAt: '',
      updatedAt: '',
    },
  ];

  const rows: ParsedStatementRow[] = [
    {
      date: '2026-07-05',
      period: '2026-07',
      amount: 21700,
      vs: '1201',
      counterparty: 'Petra Nováková',
      message: 'najem cervenec',
      rawLine: '',
    },
    {
      date: '2026-07-06',
      period: '2026-07',
      amount: 15900,
      vs: '3304',
      counterparty: 'Tereza Horáková',
      message: 'najemne + sluzby',
      rawLine: '',
    },
    {
      date: '2026-07-06',
      period: '2026-07',
      amount: 15950, // wrong amount for 3304
      vs: '3304',
      counterparty: 'Tereza Horáková',
      message: 'najemne + sluzby',
      rawLine: '',
    },
    {
      date: '2026-07-07',
      period: '2026-07',
      amount: 28100,
      vs: '8802',
      counterparty: 'Martin Dvořák',
      message: 'najem 07/2026',
      rawLine: '',
    },
    {
      date: '2026-07-09',
      period: '2026-07',
      amount: 42350,
      vs: null,
      counterparty: 'Zaměstnavatel s.r.o.',
      message: 'mzda',
      rawLine: '',
    },
    {
      date: '2026-07-11',
      period: '2026-07',
      amount: 12000,
      vs: '9910',
      counterparty: 'Neznámý odesílatel',
      message: 'vratka',
      rawLine: '',
    },
  ];

  it('batch matches mixed statement with correct classifications', () => {
    const results = matchStatement(rows, tenancies, []);

    // Results sorted: match > amount_mismatch > duplicate > nomatch

    // Two exact matches (VS 1201 @ 21700, VS 8802 @ 28100)
    const matches = results.filter((r) => r.classification === 'match');
    expect(matches).toHaveLength(2);

    // One amount mismatch (VS 3304 @ 15950 vs expected 15900)
    const mismatches = results.filter((r) => r.classification === 'amount_mismatch');
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]!.expectedAmount).toBe(15900);
    expect(mismatches[0]!.row.amount).toBe(15950);

    // Two nomatches (no VS + unknown VS)
    const nomatches = results.filter((r) => r.classification === 'nomatch');
    expect(nomatches).toHaveLength(2);
  });

  it('getPreselected returns only exact matches', () => {
    const results = matchStatement(rows, tenancies, []);
    const preselected = getPreselected(results);
    expect(preselected).toHaveLength(2);
    expect(preselected.every((r) => r.classification === 'match')).toBe(true);
  });

  it('handles duplicate when period already paid', () => {
    const existingPayment: Payment = {
      id: 'p-existing',
      landlordId: 'l1',
      tenancyId: 't-1201',
      period: '2026-07',
      amount: 21700,
      paidDate: '2026-07-05',
      method: 'Převod',
      sourceMetadata: null,
      createdAt: '',
      updatedAt: '',
    };
    // Only one row: VS 1201, period 2026-07, but already paid
    const singleRow: ParsedStatementRow = {
      date: '2026-07-20',
      period: '2026-07',
      amount: 21700,
      vs: '1201',
      counterparty: 'Petra Nováková',
      message: '',
      rawLine: '',
    };
    const results = matchStatement([singleRow], tenancies, [existingPayment]);
    expect(results).toHaveLength(1);
    expect(results[0]!.classification).toBe('duplicate');
  });

  it('flags amount_mismatch when VS matches but amount differs (fixture)', () => {
    // Use the specific fixture from the spec: VS 3304 with 15 950 instead of 15 900
    const row: ParsedStatementRow = {
      date: '2026-07-06',
      period: '2026-07',
      amount: 15950,
      vs: '3304',
      counterparty: 'Tereza Horáková',
      message: '',
      rawLine: '',
    };
    const result = matchRow(row, tenancies, []);
    expect(result.classification).toBe('amount_mismatch');
    expect(result.expectedAmount).toBe(15900);
  });

  it('unknown VS -> nomatch', () => {
    const row: ParsedStatementRow = {
      date: '2026-07-11',
      period: '2026-07',
      amount: 12000,
      vs: '9910',
      counterparty: 'Neznámý odesílatel',
      message: '',
      rawLine: '',
    };
    const result = matchRow(row, tenancies, []);
    expect(result.classification).toBe('nomatch');
  });
});

// ============================================================================
// Settlement calculator tests
// ============================================================================

describe('calculateSettlement', () => {
  it('computes přeplatek when advances > costs', () => {
    const costs: SettlementCostItem[] = [
      { label: 'Teplo a teplá voda', amount: 12000 },
      { label: 'Úklid', amount: 3000 },
    ];
    const result = calculateSettlement(20000, costs);
    expect(result.advancesTotal).toBe(20000);
    expect(result.costsTotal).toBe(15000);
    expect(result.result).toBe(5000);
    expect(result.kind).toBe('přeplatek');
  });

  it('computes nedoplatek when advances < costs', () => {
    const costs: SettlementCostItem[] = [
      { label: 'Teplo a teplá voda', amount: 15000 },
      { label: 'Úklid', amount: 10000 },
    ];
    const result = calculateSettlement(20000, costs);
    expect(result.costsTotal).toBe(25000);
    expect(result.result).toBe(-5000);
    expect(result.kind).toBe('nedoplatek');
  });

  it('works with zero costs', () => {
    const result = calculateSettlement(10000, []);
    expect(result.result).toBe(10000);
    expect(result.kind).toBe('přeplatek');
  });

  it('verifies exact koruna math', () => {
    const costs: SettlementCostItem[] = [
      { label: 'Teplo a teplá voda', amount: 12345 },
      { label: 'Studená voda a stočné', amount: 6789 },
    ];
    const result = calculateSettlement(19134, costs);
    expect(result.result).toBe(0); // exactly balanced
  });
});

describe('computeAdvancesFromRecords', () => {
  it('multiplies activeMonths by monthlyServiceAdvances', () => {
    expect(computeAdvancesFromRecords(12, 1700)).toBe(20400);
  });
  it('returns 0 for 0 active months', () => {
    expect(computeAdvancesFromRecords(0, 1700)).toBe(0);
  });
});

// ============================================================================
// cs-CZ formatter tests
// ============================================================================

describe('formatNumber', () => {
  it('formats 21700 → "21 700" (no fraction by default)', () => {
    // Intl.NumberFormat "cs-CZ" with 0 fraction digits
    const result = formatNumber(21700, 0);
    // On macOS with full ICU, this should be "21 700" (nbsp as thousands sep)
    expect(result).toMatch(/21\s*700/);
  });

  it('formats with fraction digits 218056.50 → "218 056,5"', () => {
    const result = formatNumber(218056.5, 1);
    expect(result).toMatch(/218\s*056[,.]5/);
  });
});

describe('czk', () => {
  it('returns "21 700 Kč" style', () => {
    const result = czk(21700);
    expect(result).toContain('Kč');
    expect(result).toMatch(/21\s*700/);
  });
});

describe('czkInt', () => {
  it('returns integer CZK', () => {
    const result = czkInt(21700);
    expect(result).toContain('Kč');
    // No comma/desetinná čárka
    expect(result).not.toContain(',');
  });
});

describe('formatDate', () => {
  it('formats 2026-07-05 as Czech date', () => {
    const d = new Date(2026, 6, 5); // July 5
    const result = formatDate(d);
    expect(result).toMatch(/5\.\s*7\.\s*2026/);
  });
});

describe('formatIsoDate', () => {
  it('formats ISO string', () => {
    const result = formatIsoDate('2026-07-05');
    expect(result).toMatch(/5\.\s*7\.\s*2026/);
  });
});

describe('formatPeriod', () => {
  it('returns "Červenec 2026" for "2026-07"', () => {
    expect(formatPeriod('2026-07')).toBe('Červenec 2026');
  });
  it('returns "Leden 2026" for "2026-01"', () => {
    expect(formatPeriod('2026-01')).toBe('Leden 2026');
  });
});

describe('formatPercent', () => {
  it('formats 2.8%', () => {
    const result = formatPercent(2.8);
    expect(result).toContain('2,8');
    expect(result).toContain('%');
  });
});