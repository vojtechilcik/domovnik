import { z } from 'zod';

// ---- Agent JSON schemas (§6) ----

export const triageResultSchema = z.object({
  kategorie: z.string(),
  nalehavost: z.enum(['nízká', 'střední', 'vysoká', 'havárie']),
  bezpecnost: z.object({
    riziko: z.boolean(),
    poznamka: z.string().nullable(),
  }),
  odpovednost: z.object({
    strana: z.enum(['nájemník', 'pronajímatel', 'nejasné']),
    duvod: z.string(),
  }),
  shrnuti: z.string(),
  doporuceny_remeslnik: z.string(),
  doporucene_kroky: z.array(z.string()),
  doplnujici_otazky: z.array(z.string()),
  odhad_nakladu: z.string().nullable(),
});

export const draftActionsResultSchema = z.object({
  zprava_najemnikovi: z.string(),
  poptavka_remeslnikovi: z.string(),
  doporuceny_stav: z.enum(['Nová', 'V řešení', 'Zadáno řemeslníkovi']),
  potreba_doplnit: z.boolean(),
});

// ---- Domain entity schemas (for validation) ----

export const unitTypeSchema = z.enum(['Byt', 'Dům', 'Nebytový prostor', 'Garáž', 'Pozemek', 'Jiné']);

export const paymentMethodSchema = z.enum(['Převod', 'Ručně', 'Bankovní výpis']);

export const inspectionTypeSchema = z.enum([
  'Revize plynu',
  'Revize elektroinstalace',
  'Kontrola komína',
  'Servis kotle',
  'Revize hasicího přístroje',
  'Odečet měřidel',
  'Jiné',
]);

export const settlementCostLabelSchema = z.enum([
  'Teplo a teplá voda',
  'Studená voda a stočné',
  'Elektřina společných prostor',
  'Úklid',
  'Výtah',
  'Odvoz odpadu',
  'Správa domu / fond oprav',
  'Ostatní',
]);

export const repairCategorySchema = z.enum([
  'Voda a odpad',
  'Topení',
  'Elektro',
  'Spotřebiče',
  'Okna a dveře',
  'Zámky a klíče',
  'Plíseň / vlhkost',
  'Společné prostory',
  'Jiné',
]);

export const repairStatusSchema = z.enum([
  'Zpracovává se',
  'Nová',
  'V řešení',
  'Zadáno řemeslníkovi',
  'Vyřešeno',
]);

export const messageFromSchema = z.enum(['nájemník', 'správce', 'asistent']);

export const autonomyModeSchema = z.enum(['auto', 'assist']);

export const settlementCostItemSchema = z.object({
  label: settlementCostLabelSchema,
  amount: z.number(),
});

export const createUnitSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  areaM2: z.number().positive(),
  type: unitTypeSchema,
});

export const createTenancySchema = z.object({
  unitId: z.string().uuid(),
  tenantUserId: z.string().uuid().nullable().optional(),
  tenantName: z.string().min(1),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  rent: z.number().int().positive(),
  serviceAdvances: z.number().int().min(0),
  deposit: z.number().int().nullable().optional(),
  variableSymbol: z.string().min(1),
  leaseStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  leaseEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const createPaymentSchema = z.object({
  tenancyId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().int().positive(),
  paidDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  method: paymentMethodSchema,
});

export const createInspectionSchema = z.object({
  unitId: z.string().uuid(),
  type: inspectionTypeSchema,
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().nullable().optional(),
});

export const createSettlementSchema = z.object({
  unitId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  tenantName: z.string().min(1),
  advancesTotal: z.number().int().min(0),
  costs: z.array(settlementCostItemSchema),
});

export const createRepairRequestSchema = z.object({
  unitId: z.string().uuid(),
  tenancyId: z.string().uuid(),
  category: repairCategorySchema,
  description: z.string().min(1),
  photoUrls: z.array(z.string()).optional().default([]),
});

export const createMessageSchema = z.object({
  repairRequestId: z.string().uuid(),
  from: messageFromSchema,
  text: z.string().min(1),
});

export const updateLandlordSettingsSchema = z.object({
  autonomy: autonomyModeSchema.optional(),
  notifyOnNewRequest: z.boolean().optional(),
  notifyOnEmergency: z.boolean().optional(),
});

// ---- Statement import ----

export const statementRowSchema = z.object({
  date: z.string(),
  period: z.string(),
  amount: z.number().positive(),
  vs: z.string().nullable(),
  counterparty: z.string(),
  message: z.string().nullable(),
  rawLine: z.string(),
});