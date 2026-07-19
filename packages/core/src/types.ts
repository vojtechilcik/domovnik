// Domain types for all §3 entities and §6 agent JSON shapes.
// These are the canonical TypeScript types; zod schemas are in schemas.ts.

// ---- Enums ----

export type UserRole = 'LANDLORD' | 'TENANT';

export type UnitType = 'Byt' | 'Dům' | 'Nebytový prostor' | 'Garáž' | 'Pozemek' | 'Jiné';

export type PaymentMethod = 'Převod' | 'Ručně' | 'Bankovní výpis';

export type MatchStatus = 'match' | 'amount_mismatch' | 'duplicate' | 'nomatch';

export type InspectionType =
  | 'Revize plynu'
  | 'Revize elektroinstalace'
  | 'Kontrola komína'
  | 'Servis kotle'
  | 'Revize hasicího přístroje'
  | 'Odečet měřidel'
  | 'Jiné';

export type SettlementCostLabel =
  | 'Teplo a teplá voda'
  | 'Studená voda a stočné'
  | 'Elektřina společných prostor'
  | 'Úklid'
  | 'Výtah'
  | 'Odvoz odpadu'
  | 'Správa domu / fond oprav'
  | 'Ostatní';

export type RepairCategory =
  | 'Voda a odpad'
  | 'Topení'
  | 'Elektro'
  | 'Spotřebiče'
  | 'Okna a dveře'
  | 'Zámky a klíče'
  | 'Plíseň / vlhkost'
  | 'Společné prostory'
  | 'Jiné';

export type RepairStatus = 'Zpracovává se' | 'Nová' | 'V řešení' | 'Zadáno řemeslníkovi' | 'Vyřešeno';

export type MessageFrom = 'nájemník' | 'správce' | 'asistent';

export type AutonomyMode = 'auto' | 'assist';

// ---- Agent JSON types (§6) ----

export type UrgencyLevel = 'nízká' | 'střední' | 'vysoká' | 'havárie';

export type ResponsibilityParty = 'nájemník' | 'pronajímatel' | 'nejasné';

export interface TriageResult {
  kategorie: string;
  nalehavost: UrgencyLevel;
  bezpecnost: { riziko: boolean; poznamka: string | null };
  odpovednost: { strana: ResponsibilityParty; duvod: string };
  shrnuti: string;
  doporuceny_remeslnik: string;
  doporucene_kroky: string[];
  doplnujici_otazky: string[];
  odhad_nakladu: string | null;
}

export interface DraftActionsResult {
  zprava_najemnikovi: string;
  poptavka_remeslnikovi: string;
  doporuceny_stav: 'Nová' | 'V řešení' | 'Zadáno řemeslníkovi';
  potreba_doplnit: boolean;
}

// ---- Agent log entry ----

export interface AgentLogEntry {
  detail: string;
  at: string; // ISO 8601
}

// ---- Domain entities ----

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  name: string;
  phone: string | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
}

export interface Unit {
  id: string;
  landlordId: string;
  name: string;
  address: string;
  areaM2: number;
  type: UnitType;
  createdAt: string;
  updatedAt: string;
}

export interface Tenancy {
  id: string;
  landlordId: string;
  unitId: string;
  tenantUserId: string | null;
  tenantName: string;
  phone: string | null;
  email: string | null;
  rent: number; // CZK/month
  serviceAdvances: number; // CZK/month
  deposit: number | null;
  variableSymbol: string;
  leaseStart: string; // ISO date
  leaseEnd: string | null; // null = indefinite
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  landlordId: string;
  tenancyId: string;
  period: string; // YYYY-MM
  amount: number;
  paidDate: string | null;
  method: PaymentMethod;
  sourceMetadata: {
    counterpartyName?: string;
    vs?: string;
    bankTransactionId?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface BankTransaction {
  id: string;
  landlordId: string;
  date: string;
  amount: number;
  vs: string | null;
  counterparty: string;
  message: string | null;
  matchStatus: MatchStatus;
  linkedPaymentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Inspection {
  id: string;
  landlordId: string;
  unitId: string;
  type: InspectionType;
  dueDate: string;
  done: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementCostItem {
  label: SettlementCostLabel;
  amount: number;
}

export interface Settlement {
  id: string;
  landlordId: string;
  unitId: string;
  year: number;
  tenantName: string;
  advancesTotal: number;
  costs: SettlementCostItem[];
  createdAt: string;
  updatedAt: string;
}

export interface RepairRequest {
  id: string;
  landlordId: string;
  unitId: string;
  tenancyId: string;
  category: RepairCategory;
  description: string;
  photoUrls: string[];
  status: RepairStatus;
  triage: TriageResult | null;
  triageError: string | null;
  aiSolution: string | null;
  enquiryDraft: string | null;
  tenantDraft: string | null;
  agentLog: AgentLogEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  repairRequestId: string;
  from: MessageFrom;
  text: string;
  at: string;
}

export interface LandlordSettings {
  id: string;
  landlordId: string;
  autonomy: AutonomyMode;
  notifyOnNewRequest: boolean;
  notifyOnEmergency: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---- Parsed bank statement row ----

export interface ParsedStatementRow {
  date: string; // ISO date YYYY-MM-DD
  period: string; // YYYY-MM derived from date
  amount: number; // in CZK (positive = credit / incoming)
  vs: string | null;
  counterparty: string;
  message: string | null;
  rawLine: string;
}

// ---- Reconciliation match result ----

export type MatchResultClass = 'match' | 'amount_mismatch' | 'duplicate' | 'nomatch';

export interface MatchResult {
  row: ParsedStatementRow;
  classification: MatchResultClass;
  tenancyId: string | null;
  expectedAmount: number | null; // rent + services for the matched tenancy
  existingPaymentId: string | null; // if duplicate
  reason: string;
}

// ---- Settlement result ----

export interface SettlementResult {
  advancesTotal: number;
  costsTotal: number;
  result: number; // advances − costs (positive = přeplatek, negative = nedoplatek)
  kind: 'přeplatek' | 'nedoplatek';
}