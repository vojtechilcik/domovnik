import { Injectable } from '@nestjs/common';

/**
 * LlmService interface — abstracts the AI provider so the model vendor is swappable.
 * The API key lives server-side only, never exposed to clients.
 */
export interface LlmService {
  /**
   * Chat completion with optional image (vision) input.
   * @param systemPrompt — system role message (Czech instructions for the agent)
   * @param userPrompt — user message (fault description, context)
   * @param imageBase64 — optional base64-encoded photo for vision models
   * @param jsonMode — if true, force strict JSON output (used for triage + draft actions)
   */
  chat(systemPrompt: string, userPrompt: string, imageBase64?: string, jsonMode?: boolean): Promise<string>;
}

/**
 * WebSearchTool abstraction — searches for a reliable tradesperson near the unit's address.
 */
export interface WebSearchTool {
  /**
   * Search for a tradesperson for a given problem near an address.
   * Returns ~3 concrete options with indicative price ranges.
   */
  searchTradesperson(query: string, address: string): Promise<string[]>;
}

/**
 * Default mock implementation for development/testing.
 * In production, swap with OpenAI, Anthropic, or a Czech-optimized provider.
 */
@Injectable()
export class MockLlmService implements LlmService {
  async chat(systemPrompt: string, userPrompt: string, _imageBase64?: string, jsonMode?: boolean): Promise<string> {
    // Simulate realistic Czech agent responses based on the prompt content
    if (jsonMode && systemPrompt.includes('triage')) {
      return this.mockTriage(userPrompt);
    }
    if (jsonMode && systemPrompt.includes('draft')) {
      return this.mockDraftActions(userPrompt);
    }
    if (systemPrompt.includes('follow-up') || systemPrompt.includes('zpráva')) {
      return 'Dobrý den, děkuji za upřesnění. Předal jsem informace správci nemovitosti. Ozve se Vám co nejdříve.';
    }
    return 'Děkuji za zprávu. Závada je v řešení.';
  }

  private mockTriage(description: string): string {
    const hasWater = /voda|pračk|hadičk|potopa|vytopen/i.test(description);
    const hasHeating = /topen|tepl|zima|chlad/i.test(description);
    const hasElectricity = /elektř|zásuvk|jistič|zkrat/i.test(description);
    const hasMold = /plís|vlhko|mok/i.test(description);
    const hasLock = /klik|zámk|dveř|klíč/i.test(description);

    if (hasWater) {
      return JSON.stringify({
        kategorie: 'Voda a odpad',
        nalehavost: 'havárie',
        bezpecnost: { riziko: true, poznamka: 'Hrozí poškození podlahy a úraz elektrickým proudem. Okamžitě vypněte hlavní přívod vody a odpojte spotřebiče ze zásuvky.' },
        odpovednost: { strana: 'pronajímatel', duvod: 'Jedná se o závadu na vnitřním rozvodu vody, který spravuje pronajímatel dle NV č. 308/2015 Sb. § 4 odst. 1.' },
        shrnuti: 'Prasklá hadička způsobuje únik vody. Je nutné okamžitě zastavit přívod a zavolat instalatéra.',
        doporuceny_remeslnik: 'Instalatér — havarijní služba (nonstop)',
        doporucene_kroky: ['Okamžitě uzavřít hlavní přívod vody', 'Odpojit pračku a další spotřebiče ze zásuvky', 'Kontaktovat havarijního instalatéra'],
        doplnujici_otazky: ['Je poškozená podlaha?'],
        odhad_nakladu: '2 000–6 000 Kč',
      });
    }

    if (hasHeating) {
      return JSON.stringify({
        kategorie: 'Topení',
        nalehavost: 'vysoká',
        bezpecnost: { riziko: false, poznamka: null },
        odpovednost: { strana: 'pronajímatel', duvod: 'Topení je součástí technického zařízení budovy — odpovědnost pronajímatele dle NV č. 308/2015 Sb.' },
        shrnuti: 'Netopící topení v obývacím pokoji. Pravděpodobně zavzdušněný radiátor nebo závada na termostatickém ventilu.',
        doporuceny_remeslnik: 'Topnář / instalatér',
        doporucene_kroky: ['Zkontrolovat termostatický ventil', 'Odsvzdušnit radiátor', 'Pokud nepomůže, zavolat topnáře'],
        doplnujici_otazky: ['Topí ostatní radiátory v bytě?', 'Slyšíte v radiátoru bublání?'],
        odhad_nakladu: '500–3 000 Kč',
      });
    }

    if (hasElectricity) {
      return JSON.stringify({
        kategorie: 'Elektro',
        nalehavost: 'havárie',
        bezpecnost: { riziko: true, poznamka: 'Nebezpečí úrazu elektrickým proudem! Nedotýkejte se mokrých zásuvek.' },
        odpovednost: { strana: 'pronajímatel', duvod: 'Elektroinstalace je součástí stavby — odpovědnost pronajímatele.' },
        shrnuti: 'Elektrická závada s bezpečnostním rizikem. Nutný zásah elektrikáře.',
        doporuceny_remeslnik: 'Elektrikář — havarijní služba',
        doporucene_kroky: ['Vypnout příslušný jistič', 'Nedotýkat se poškozených částí', 'Zavolat elektrikáře'],
        doplnujici_otazky: [],
        odhad_nakladu: '1 500–5 000 Kč',
      });
    }

    if (hasMold) {
      return JSON.stringify({
        kategorie: 'Plíseň / vlhkost',
        nalehavost: 'střední',
        bezpecnost: { riziko: false, poznamka: 'Dlouhodobé vystavení plísni může mít zdravotní následky.' },
        odpovednost: { strana: 'nejasné', duvod: 'Záleží na příčině — pokud jde o stavební vadu (např. tepelný most), odpovídá pronajímatel. Pokud nedostatečné větrání, nájemník.' },
        shrnuti: 'Výskyt plísně na zdi. Je třeba zjistit příčinu a navrhnout řešení.',
        doporuceny_remeslnik: 'Stavební specialista / mykolog',
        doporucene_kroky: ['Zvýšit intenzitu větrání', 'Zdokumentovat rozsah', 'Objednat odborné posouzení'],
        doplnujici_otazky: ['Jak dlouho se plíseň objevuje?', 'Je zeď na dotek vlhká?'],
        odhad_nakladu: '3 000–15 000 Kč',
      });
    }

    if (hasLock) {
      return JSON.stringify({
        kategorie: 'Zámky a klíče',
        nalehavost: 'nízká',
        bezpecnost: { riziko: false, poznamka: null },
        odpovednost: { strana: 'nájemník', duvod: 'Běžná údržba kliky a zámku spadá pod drobné opravy hrazené nájemníkem dle NV č. 308/2015 Sb.' },
        shrnuti: 'Uvolněná klika u dveří. Jedná se o drobnou opravu, kterou může provést nájemník nebo zámečník.',
        doporuceny_remeslnik: 'Zámečník',
        doporucene_kroky: ['Zkusit dotáhnout šrouby na klice', 'Pokud nepomůže, zavolat zámečníka'],
        doplnujici_otazky: [],
        odhad_nakladu: '300–1 000 Kč',
      });
    }

    // Default
    return JSON.stringify({
      kategorie: 'Jiné',
      nalehavost: 'střední',
      bezpecnost: { riziko: false, poznamka: null },
      odpovednost: { strana: 'nejasné', duvod: 'Nutné bližší posouzení.' },
      shrnuti: 'Závada byla přijata. Je třeba další upřesnění.',
      doporuceny_remeslnik: 'Dle povahy závady',
      doporucene_kroky: ['Upřesnit popis závady', 'Posoudit rozsah'],
      doplnujici_otazky: ['Můžete závadu blíže popsat?', 'Jak dlouho problém trvá?'],
      odhad_nakladu: null,
    });
  }

  private mockDraftActions(description: string): string {
    const hasWater = /voda|pračk|hadičk/i.test(description);
    const isEmergency = /havár|havar/i.test(description) || hasWater;

    if (hasWater) {
      return JSON.stringify({
        zprava_najemnikovi: 'Dobrý den, děkujeme za nahlášení závady. Jedná se o havarijní stav — prosím okamžitě zavřete hlavní přívod vody a odpojte pračku ze zásuvky. Kontaktovali jsme havarijního instalatéra, který Vás bude co nejdříve kontaktovat. V případě velkého úniku vody volejte 112.',
        poptavka_remeslnikovi: 'Dobrý den, potřebujeme opravit prasklou přívodní hadičku k pračce v bytě na adrese Sokolovská 45, Praha 8. Jedná se o havarijní stav. Prosím o kontaktování nájemníka a dohodnutí termínu. Orientační rozpočet: 2 000–6 000 Kč.',
        doporuceny_stav: 'Zadáno řemeslníkovi',
        potreba_doplnit: false,
      });
    }

    if (isEmergency) {
      return JSON.stringify({
        zprava_najemnikovi: 'Dobrý den, závadu jsme vyhodnotili jako havarijní. Prosím dodržujte bezpečnostní opatření. Kontaktovali jsme odborníka, který Vás bude kontaktovat. V případě ohrožení zdraví volejte 112.',
        poptavka_remeslnikovi: 'Havarijní závada — prosíme o urychlený zásah. Adresa: viz detail požadavku.',
        doporuceny_stav: 'Zadáno řemeslníkovi',
        potreba_doplnit: false,
      });
    }

    return JSON.stringify({
      zprava_najemnikovi: 'Dobrý den, děkujeme za nahlášení závady. Závadu jsme zaevidovali a posoudíme ji. Ozveme se Vám s dalším postupem.',
      poptavka_remeslnikovi: 'Nová závada k posouzení. Prosím o kontaktování správce.',
      doporuceny_stav: 'Nová',
      potreba_doplnit: false,
    });
  }
}

@Injectable()
export class MockWebSearchTool implements WebSearchTool {
  async searchTradesperson(query: string, address: string): Promise<string[]> {
    return [
      `🔧 **Instalatérství Novák** — Havarijní služba 24/7, ${address}. Tel: +420 777 111 222. Orientační cena: 2 500–5 000 Kč dle rozsahu.`,
      `🔧 **Voda-Servis s.r.o.** — Specializace na havárie vody a topení. Dojezd do 60 min v Praze. Tel: +420 777 333 444. Cena od 1 800 Kč/h.`,
      `🔧 **Instalatér Praha** — Josef Dvořák, nonstop pohotovost. Hodnocení 4.8 ⭐. Tel: +420 777 555 666.`,
    ];
  }
}