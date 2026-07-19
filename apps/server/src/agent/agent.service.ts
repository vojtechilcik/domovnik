import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RepairRequestsService } from '../repair-requests/repair-requests.service.js';
import { MessagesService } from '../messages/messages.service.js';
import { MockLlmService, MockWebSearchTool } from '../llm/llm.service.js';
import type { LlmService, WebSearchTool } from '../llm/llm.service.js';
import type { AgentLogEntry } from '@domovnik/core';

/**
 * Agent pipeline — Phase 6.
 * Runs server-side only. LLM API key never reaches clients.
 * Triggered on repair request creation, manual "spustit agenta znovu", or tenant follow-up in auto mode.
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly llm: LlmService;
  private readonly search: WebSearchTool;

  constructor(
    private readonly prisma: PrismaService,
    private readonly repairRequests: RepairRequestsService,
    private readonly messages: MessagesService,
  ) {
    // Swap these with real OpenAI/Anthropic implementations in production
    this.llm = new MockLlmService();
    this.search = new MockWebSearchTool();
  }

  /**
   * Run the full agent pipeline for a repair request.
   * Steps: Triage → Search gate → Solution search → Draft actions → Act by autonomy mode
   */
  async processRequest(landlordId: string, repairRequestId: string): Promise<void> {
    this.logger.log(`Agent pipeline started for request ${repairRequestId}`);

    const settings = await this.prisma.landlordSettings.findUnique({
      where: { landlordId },
    });
    const isAuto = settings?.autonomy === 'auto';

    // Fetch the request
    const request = await this.repairRequests.findOne(landlordId, repairRequestId);
    const log: AgentLogEntry[] = [];

    try {
      // Step 1 — Triage
      const triageJson = await this.llm.chat(
        TRIAGE_SYSTEM_PROMPT,
        buildTriagePrompt(request.description, request.category),
        undefined,
        true,
      );
      const triage = JSON.parse(triageJson);
      await this.repairRequests.setTriage(landlordId, repairRequestId, triage);
      log.push({ detail: `Třídění dokončeno: nalehavost=${triage.nalehavost}, odpovednost=${triage.odpovednost.strana}, odhad=${triage.odhad_nakladu ?? 'neuvedeno'}`, at: new Date().toISOString() });

      // Step 2 — Search gate
      const skipSearch = triage.nalehavost === 'nízká' && triage.odpovednost?.strana === 'nájemník';
      let searchResults: string[] = [];
      if (skipSearch) {
        log.push({ detail: 'Drobná oprava — vyhledávání řemeslníka není nutné.', at: new Date().toISOString() });
      } else {
        const query = `${triage.kategorie} — ${triage.doporuceny_remeslnik}`;
        searchResults = await this.search.searchTradesperson(query, 'Praha');
        log.push({ detail: `Vyhledání řemeslníka: nalezeno ${searchResults.length} možností.`, at: new Date().toISOString() });
      }

      // Step 3 — Draft actions
      const draftJson = await this.llm.chat(
        DRAFT_SYSTEM_PROMPT,
        JSON.stringify({ triage, description: request.description }),
        undefined,
        true,
      );
      const draft = JSON.parse(draftJson);
      log.push({ detail: `Připravena odpověď a poptávka. Doporučený stav: ${draft.doporuceny_stav}.`, at: new Date().toISOString() });

      // Step 4 — Act by autonomy mode
      if (isAuto) {
        // Auto mode: post tenant message, set status, store enquiry draft
        await this.messages.create(repairRequestId, {
          from: 'asistent',
          text: draft.zprava_najemnikovi,
        });

        let newStatus = draft.doporuceny_stav;
        if (triage.nalehavost === 'havárie' || triage.bezpecnost?.riziko) {
          newStatus = 'Zadáno řemeslníkovi';
        }
        if (draft.potreba_doplnit) {
          newStatus = 'Nová';
        }

        await this.repairRequests.updateStatus(landlordId, repairRequestId, newStatus);
        await this.repairRequests.setDrafts(landlordId, repairRequestId, {
          enquiryDraft: draft.poptavka_remeslnikovi,
          aiSolution: searchResults.join('\n') || null,
        });
        log.push({ detail: `AUTO mód: zpráva odeslána nájemníkovi, stav nastaven na ${newStatus}, poptávka uložena.`, at: new Date().toISOString() });
      } else {
        // Assist mode: stage reply, set status Nová, send nothing
        await this.repairRequests.setDrafts(landlordId, repairRequestId, {
          tenantDraft: draft.zprava_najemnikovi,
          enquiryDraft: draft.poptavka_remeslnikovi,
          aiSolution: searchResults.join('\n') || null,
        });
        await this.repairRequests.updateStatus(landlordId, repairRequestId, 'Nová');
        log.push({ detail: 'ASSIST mód: odpověď připravena ke schválení (nic neodesláno).', at: new Date().toISOString() });
      }
    } catch (err: any) {
      this.logger.error(`Agent pipeline failed for ${repairRequestId}: ${err.message}`);
      log.push({ detail: `CHYBA: ${err.message}`, at: new Date().toISOString() });
      await this.repairRequests.setTriage(landlordId, repairRequestId, null);
    }

    // Persist log
    for (const entry of log) {
      await this.repairRequests.addAgentLog(landlordId, repairRequestId, entry);
    }

    this.logger.log(`Agent pipeline complete for ${repairRequestId} (${log.length} steps)`);
  }

  /**
   * Handle a follow-up tenant message in auto mode.
   */
  async handleFollowUp(repairRequestId: string, tenantMessage: string): Promise<void> {
    const settings = await this.prisma.landlordSettings.findFirst({
      where: { landlordId: (await this.prisma.repairRequest.findUnique({ where: { id: repairRequestId } }))?.landlordId! },
    });

    if (settings?.autonomy !== 'auto') return;

    const reply = await this.llm.chat(
      FOLLOW_UP_SYSTEM_PROMPT,
      tenantMessage,
    );

    await this.messages.create(repairRequestId, {
      from: 'asistent',
      text: reply,
    });
  }
}

// ---- System prompts (Czech) ----

const TRIAGE_SYSTEM_PROMPT = `Jsi zkušený asistent pro správu nemovitostí v České republice. Tvoje role je triage — třídění závad.
Na základě popisu závady, adresy jednotky, kategorie a případné fotografie:

1. Klasifikuj závadu.
2. Posuď naléhavost a bezpečnostní riziko.
3. Uveď orientační, nezávazný názor na odpovědnost za náklady s odkazem na nařízení vlády č. 308/2015 Sb. (drobné opravy a běžná údržba jdou za nájemníkem, větší opravy za pronajímatelem).
4. Doporuč řemeslníka a konkrétní kroky.

Odpověz POUZE validním JSON dle schématu:
{
  "kategorie": string,
  "nalehavost": "nízká" | "střední" | "vysoká" | "havárie",
  "bezpecnost": { "riziko": boolean, "poznamka": string | null },
  "odpovednost": { "strana": "nájemník" | "pronajímatel" | "nejasné", "duvod": string },
  "shrnuti": string (1–2 věty pro nájemníka),
  "doporuceny_remeslnik": string,
  "doporucene_kroky": string[] (2–3),
  "doplnujici_otazky": string[] (0–3),
  "odhad_nakladu": string | null (orientační rozsah v Kč)
}`;

const DRAFT_SYSTEM_PROMPT = `Jsi asistent pro správu nemovitostí. Na základě výsledku třídění závady a popisu:

1. Napiš vřelou českou odpověď nájemníkovi (2–4 věty): potvrzení přijetí, co se bude dít dál, maximálně jedna doplňující otázka. Pokud je bezpečnostní riziko, uveď okamžité bezpečnostní instrukce a česká tísňová čísla (plyn 1239, obecná 112).
2. Napiš krátkou věcnou poptávku pro řemeslníka: popis závady, adresa jednotky, žádost o termín a cenu.
3. Doporuč stav požadavku.
4. Urči, zda popis závady je dostatečný pro objednání řemeslníka.

Odpověz POUZE validním JSON:
{
  "zprava_najemnikovi": string,
  "poptavka_remeslnikovi": string,
  "doporuceny_stav": "Nová" | "V řešení" | "Zadáno řemeslníkovi",
  "potreba_doplnit": boolean
}`;

const FOLLOW_UP_SYSTEM_PROMPT = `Jsi asistent pro správu nemovitostí. Odpovídáš na zprávu nájemníka ohledně existující závady.
Napiš vřelou, stručnou odpověď (1–3 věty), která posune řešení vpřed. Nevymýšlej si nepotvrzené termíny návštěv.`;

function buildTriagePrompt(description: string, category: string): string {
  return `Popis závady: ${description}\nKategorie: ${category}\nAdresa: Praha (automaticky doplněno)`;
}