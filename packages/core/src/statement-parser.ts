import type { ParsedStatementRow } from './types.js';
import { periodKey } from './period-math.js';

/**
 * Normalize a Czech-formatted number string to a float.
 * Handles: "21 700,00", "1 500,50", "42 350,00", "1200" (integer)
 * Czech format: space as thousands separator, comma as decimal separator.
 */
export function parseCzechAmount(raw: string): number {
  // Remove all spaces (non-breaking spaces too)
  let s = raw.replace(/\s/g, '').replace(/\u00A0/g, '');
  // Replace comma with dot for parseFloat
  s = s.replace(',', '.');
  const n = parseFloat(s);
  if (isNaN(n)) throw new Error(`Invalid Czech amount: "${raw}"`);
  return n;
}

/**
 * Parse a Czech date string to ISO "YYYY-MM-DD".
 * Handles: "5. 7. 2026", "11. 7. 2026", "2026-07-05" (ISO already)
 */
export function parseCzechDate(raw: string): string {
  const trimmed = raw.trim();

  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // Czech format: "d. M. yyyy" with optional spaces
  const m = trimmed.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (m) {
    const day = String(Number(m[1])).padStart(2, '0');
    const month = String(Number(m[2])).padStart(2, '0');
    const year = m[3]!;
    return `${year}-${month}-${day}`;
  }

  throw new Error(`Unparseable Czech date: "${trimmed}"`);
}

/**
 * Detect CSV delimiter by checking which of ';' or ',' appears in the header line.
 * Returns the delimiter character.
 */
export function detectDelimiter(headerLine: string): ';' | ',' {
  const semicolons = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return semicolons >= commas ? ';' : ',';
}

/**
 * Split a CSV line respecting quoted fields (double-quote escaping).
 */
export function splitCsvLine(line: string, delimiter: ';' | ','): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        // Look ahead for escaped quote ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip the next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Map CSV field names to standard column indices.
 * Returns { dateIdx, amountIdx, vsIdx, counterpartyIdx, messageIdx }
 */
export function detectColumns(headers: string[]): {
  dateIdx: number;
  amountIdx: number;
  vsIdx: number;
  counterpartyIdx: number;
  messageIdx: number;
} {
  const normalized = headers.map((h) => h.trim().toLowerCase());

  function findIdx(candidates: string[]): number {
    for (const c of candidates) {
      const idx = normalized.findIndex((h) => h === c);
      if (idx !== -1) return idx;
    }
    return -1;
  }

  const dateIdx = findIdx(['datum']);
  const amountIdx = findIdx(['objem', 'částka', 'castka']);
  const vsIdx = findIdx(['vs', 'variabilní symbol', 'variabilni symbol', 'variabilnisymbol']);
  const counterpartyIdx = findIdx([
    'protiúčet',
    'protiucet',
    'název protiúčtu',
    'nazev protiúčtu',
    'názevprotiúčtu',
    'protiúčet název',
    'název účtu',
    'nazev uctu',
    'odesílatel',
    'odesilatel',
  ]);
  const messageIdx = findIdx([
    'zpráva',
    'zprava',
    'zpráva pro příjemce',
    'zprava pro prijemce',
    'zprávapropříjemce',
    'poznámka',
    'poznamka',
  ]);

  if (dateIdx === -1) throw new Error('Could not find Datum column in CSV header');
  if (amountIdx === -1) throw new Error('Could not find Objem column in CSV header');

  return { dateIdx, amountIdx, vsIdx, counterpartyIdx, messageIdx };
}

/**
 * Parse a Czech bank CSV statement (semicolon or comma delimited).
 * Header auto-detection for: Datum/Objem/VS/Protiúčet/Zpráva
 * Returns normalized ParsedStatementRow[] for credits only (positive amounts).
 */
export function parseCsvStatement(csvText: string): ParsedStatementRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) throw new Error('CSV must contain at least a header and one data row');

  const headerLine = lines[0]!;
  const delimiter = detectDelimiter(headerLine);
  const headers = splitCsvLine(headerLine, delimiter);
  const cols = detectColumns(headers);

  const rows: ParsedStatementRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i]!, delimiter);

    const dateRaw = fields[cols.dateIdx];
    const amountRaw = fields[cols.amountIdx];
    if (!dateRaw || !amountRaw) continue;

    try {
      const date = parseCzechDate(dateRaw);
      const amount = parseCzechAmount(amountRaw);
      const vs = cols.vsIdx !== -1 && fields[cols.vsIdx] ? fields[cols.vsIdx]!.trim() : null;
      const counterparty =
        cols.counterpartyIdx !== -1 && fields[cols.counterpartyIdx]
          ? fields[cols.counterpartyIdx]!.trim()
          : '';
      const message =
        cols.messageIdx !== -1 && fields[cols.messageIdx] ? fields[cols.messageIdx]!.trim() : null;

      rows.push({
        date,
        period: periodKey(new Date(date + 'T00:00:00')),
        amount,
        vs: vs || null,
        counterparty,
        message,
        rawLine: lines[i]!,
      });
    } catch {
      // Skip unparseable rows silently
      continue;
    }
  }

  return rows;
}

// ---- GPC/ABO fixed-width format parser ----

/**
 * GPC/ABO is a Czech banking standard for fixed-width transaction files.
 * This parser handles the main transaction record type.
 *
 * Format reference (header + detail lines):
 *   Record type 074 (start), 075 (transaction detail), 076 (end)
 *
 * The 075 detail record layout (positions are character indices, 0-based from the spec):
 *   - Date: pos 60–65 (DDMMYY)
 *   - Amount: pos 41–54 (14 chars, right-aligned, last 2 = halere, leading zeros)
 *   - VS: pos 55–64 (10 chars, right-padded with zeros)
 *   - Counterparty account: pos 19–34
 *   - Counterparty name: pos 96–130
 *   - Message: pos 131–170
 *
 * This simplified parser handles the most common Czech GPC format
 * where amounts are in halere (1 CZK = 100 units).
 */
export function parseGpcAbo(text: string): ParsedStatementRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const rows: ParsedStatementRow[] = [];

  for (const line of lines) {
    // Only process detail/transaction lines (type 075 or lines with date+amount)
    // A GPC detail line is typically 200+ characters.
    if (line.length < 80) continue;

    try {
      // Detect if this is a transaction record by checking for a 6-digit date pattern
      // in the date field area (columns ~60-66)
      const dateCandidate = line.substring(59, 65).trim();
      if (!/^\d{6}$/.test(dateCandidate)) continue;

      // Date: DDMMYY -> YYYY-MM-DD (assume 20xx)
      const dd = dateCandidate.substring(0, 2);
      const mm = dateCandidate.substring(2, 4);
      const yy = dateCandidate.substring(4, 6);
      const fullYear = 2000 + parseInt(yy!, 10);
      const isoDate = `${fullYear}-${mm}-${dd}`;

      // Amount: columns 40-53 (14 chars), last 2 digits are halere
      const amountRaw = line.substring(40, 54).trim();
      const amountInt = parseInt(amountRaw, 10) || 0;
      const amount = amountInt / 100;

      // VS: columns 54-63 (10 chars)
      const vsRaw = line.substring(54, 64).trim();
      const vs = vsRaw ? vsRaw.replace(/^0+/, '') || '0' : null;

      // Counterparty account: columns 18-33
      const counterpartyAccount = line.substring(18, 34).trim();

      // Counterparty name: columns 95-129
      const counterpartyName = line.substring(95, 130).trim();

      // Message: columns 130-169
      const message = line.substring(130, 170).trim() || null;

      const counterparty = counterpartyName || counterpartyAccount || '';

      rows.push({
        date: isoDate,
        period: periodKey(new Date(isoDate + 'T00:00:00')),
        amount,
        vs,
        counterparty,
        message,
        rawLine: line,
      });
    } catch {
      continue;
    }
  }

  return rows;
}

/**
 * Unified statement parser: auto-detects CSV vs GPC/ABO format and delegates.
 */
export function parseStatement(input: string): ParsedStatementRow[] {
  const trimmed = input.trim();

  // Heuristic: if it starts with what looks like a CSV header (contains "Datum" or "datum")
  // or has semicolons/commas in the first few lines, treat as CSV.
  const firstLine = trimmed.split(/\r?\n/)[0] ?? '';

  if (/[;,;]/.test(firstLine) || /datum|Datum/i.test(firstLine)) {
    return parseCsvStatement(trimmed);
  }

  // Otherwise treat as GPC/ABO fixed-width
  return parseGpcAbo(trimmed);
}