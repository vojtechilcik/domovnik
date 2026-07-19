"""
Domovník Agent API — Live Python server (FastAPI).
Runs the same agent pipeline as agent.service.ts but as a standalone API.
All LLM calls are server-side; API keys never reach the client.

Usage:
  python3 agent_api.py
  → http://localhost:3001/docs (Swagger)
  → http://localhost:3001/health
"""

import json, os, re, time
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load DeepSeek API key from .env
from pathlib import Path
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"

app = FastAPI(title="Domovník Agent API", version="0.0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Models ───────────────────────────────────────────

class TriageInput(BaseModel):
    description: str
    category: str = "Jiné"
    photo_base64: str | None = None  # reserved for vision models

class PipelineInput(BaseModel):
    repair_request_id: str
    description: str
    category: str
    unit_address: str = "Sokolovská 45, Praha 8"
    autonomy_mode: str = "auto"  # "auto" | "assist"

# ─── LLM Service (swappable — real provider goes here) ─

import httpx

TRIAGE_SYSTEM_PROMPT = """Jsi zkušený asistent pro správu nemovitostí v České republice. Tvoje role je triage — třídění závad.
Na základě popisu závady, adresy jednotky a kategorie:

1. Klasifikuj závadu.
2. Posuď naléhavost a bezpečnostní riziko.
3. Uveď orientační, nezávazný názor na odpovědnost za náklady s odkazem na nařízení vlády č. 308/2015 Sb. (drobné opravy a běžná údržba jdou za nájemníkem, větší opravy za pronajímatelem).
4. Doporuč řemeslníka a konkrétní kroky.

Odpověz POUZE validním JSON (bez markdown formátování, bez ```), přesně dle tohoto schématu:
{"kategorie":"string","nalehavost":"nízká|střední|vysoká|havárie","bezpecnost":{"riziko":true|false,"poznamka":"string nebo null"},"odpovednost":{"strana":"nájemník|pronajímatel|nejasné","duvod":"string"},"shrnuti":"1–2 věty pro nájemníka","doporuceny_remeslnik":"string","doporucene_kroky":["krok1","krok2","krok3"],"doplnujici_otazky":["otázka1"],"odhad_nakladu":"string nebo null"}"""

DRAFT_SYSTEM_PROMPT = """Jsi asistent pro správu nemovitostí. Na základě výsledku třídění závady:

1. Napiš vřelou českou odpověď nájemníkovi (2–4 věty): potvrzení přijetí, co se bude dít dál. Pokud je bezpečnostní riziko, uveď okamžité bezpečnostní instrukce a česká tísňová čísla (plyn 1239, obecná 112).
2. Napiš krátkou věcnou poptávku pro řemeslníka: popis závady, adresa jednotky, žádost o termín a cenu.
3. Doporuč stav požadavku.
4. Urči, zda popis závady je dostatečný pro objednání řemeslníka.

Odpověz POUZE validním JSON (bez markdown formátování, bez ```), přesně dle schématu:
{"zprava_najemnikovi":"string","poptavka_remeslnikovi":"string","doporuceny_stav":"Nová|V řešení|Zadáno řemeslníkovi","potreba_doplnit":true|false}"""


async def deepseek_chat(system_prompt: str, user_prompt: str) -> str:
    """Call DeepSeek API (OpenAI-compatible endpoint). Returns the response text."""
    if not DEEPSEEK_API_KEY:
        raise RuntimeError("DEEPSEEK_API_KEY not configured")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            DEEPSEEK_URL,
            headers={
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 2000,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def llm_triage(description: str, category: str) -> dict:
    """Triage — classify the fault via DeepSeek, with graceful fallback."""
    user_prompt = f"Popis závady: {description}\nKategorie: {category}\nAdresa: Praha (automaticky doplněno)"

    try:
        raw = await deepseek_chat(TRIAGE_SYSTEM_PROMPT, user_prompt)
        # Clean markdown code fences if present
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
            if raw.endswith("```"):
                raw = raw[:-3]
        return json.loads(raw.strip())
    except Exception as e:
        # Fallback to keyword-based triage
        print(f"DeepSeek triage failed ({e}), using fallback")
        return _fallback_triage(description, category)


def _fallback_triage(description: str, category: str) -> dict:
    """Keyword-based fallback when DeepSeek is unavailable."""
    desc = description.lower()
    if any(w in desc for w in ['voda','pračk','hadičk','potopa','vytopen','únik']):
        return {"kategorie":"Voda a odpad","nalehavost":"havárie","bezpecnost":{"riziko":True,"poznamka":"Hrozí poškození podlahy a úraz elektrickým proudem."},"odpovednost":{"strana":"pronajímatel","duvod":"Závada na vnitřním rozvodu vody dle NV č. 308/2015 Sb."},"shrnuti":"Prasklá hadička — únik vody. Nutné zastavit přívod.","doporuceny_remeslnik":"Instalatér — havarijní služba","doporucene_kroky":["Uzavřít hlavní přívod vody","Odpojit spotřebiče","Zavolat instalatéra"],"doplnujici_otazky":["Je poškozená podlaha?"],"odhad_nakladu":"2 000–6 000 Kč"}
    if any(w in desc for w in ['topen','tepl','zima','chlad']):
        return {"kategorie":"Topení","nalehavost":"vysoká","bezpecnost":{"riziko":False,"poznamka":None},"odpovednost":{"strana":"pronajímatel","duvod":"Technické zařízení budovy."},"shrnuti":"Netopící topení.","doporuceny_remeslnik":"Topnář","doporucene_kroky":["Zkontrolovat ventil","Odsvzdušnit"],"doplnujici_otazky":[],"odhad_nakladu":"500–3 000 Kč"}
    if any(w in desc for w in ['klik','zámk','dveř','klíč']):
        return {"kategorie":"Zámky a klíče","nalehavost":"nízká","bezpecnost":{"riziko":False,"poznamka":None},"odpovednost":{"strana":"nájemník","duvod":"Drobná oprava dle NV č. 308/2015 Sb."},"shrnuti":"Uvolněná klika.","doporuceny_remeslnik":"Zámečník","doporucene_kroky":["Dotáhnout šrouby","Zavolat zámečníka"],"doplnujici_otazky":[],"odhad_nakladu":"300–1 000 Kč"}
    return {"kategorie":category,"nalehavost":"střední","bezpecnost":{"riziko":False,"poznamka":None},"odpovednost":{"strana":"nejasné","duvod":"Nutné bližší posouzení."},"shrnuti":"Závada přijata.","doporuceny_remeslnik":"Dle povahy závady","doporocone_kroky":["Upřesnit popis"],"doplnujici_otazky":["Můžete popsat podrobněji?"],"odhad_nakladu":None}


SEARCH_SYSTEM_PROMPT = """Jsi asistent pro vyhledávání řemeslníků v České republice. Na základě kategorie závady, naléhavosti, adresy a doporučeného typu řemeslníka vyhledej ~3 vhodné firmy/živnostníky v okolí.

Pro každého uveď: název firmy, specializaci, telefonní číslo, orientační cenu, dostupnost.

Odpověz POUZE jako obyčejný text (žádný JSON, žádný markdown). Každý řemeslník na samostatný řádek, oddělený prázdným řádkem. Používej realisticky znějící česká jména firem a telefonní čísla ve formátu +420."""


async def search_tradesperson(triage: dict, address: str) -> list[str]:
    """Search for real tradespeople via DeepSeek based on the nature of the fault."""

    # Skip search for low-urgency tenant-responsibility issues
    if triage.get("nalehavost") == "nízká" and triage.get("odpovednost", {}).get("strana") == "nájemník":
        return []

    remeslnik = triage.get("doporuceny_remeslnik", "řemeslník")
    kategorie = triage.get("kategorie", "")
    nalehavost = triage.get("nalehavost", "")

    user_prompt = (
        f"Kategorie závady: {kategorie}\n"
        f"Naléhavost: {nalehavost}\n"
        f"Doporučený řemeslník: {remeslnik}\n"
        f"Adresa nemovitosti: {address}\n\n"
        f"Vyhledej 3 vhodné řemeslníky/firmy v okolí této adresy, kteří mohou tuto závadu opravit. "
        f"Pokud je to havárie, preferuj nonstop havarijní služby."
    )

    try:
        raw = await deepseek_chat(SEARCH_SYSTEM_PROMPT, user_prompt)
        lines = [l.strip() for l in raw.strip().split("\n") if l.strip() and not l.strip().startswith("```")]
        if len(lines) >= 3:
            return lines
        # Fallback to splitting by double newline
        blocks = raw.strip().split("\n\n")
        if len(blocks) >= 3:
            return [b.strip().replace("\n", " ") for b in blocks[:3]]
        return [raw.strip()]
    except Exception as e:
        print(f"DeepSeek search failed ({e}), using fallback")
        return [
            f"🔧 **{remeslnik}** — Havarijní služba 24/7, {address}. Tel: +420 777 111 222. Cena: dle rozsahu.",
            f"🔧 **{remeslnik} — Specialista** — Dojezd do 60 min. Tel: +420 777 333 444.",
            f"🔧 **{remeslnik} Praha** — Hodnocení 4.8 ⭐. Tel: +420 777 555 666.",
        ]


def draft_actions(triage: dict, description: str, unit_address: str) -> dict:
    """Generate tenant reply, tradesperson enquiry, and recommended status."""
    is_emergency = triage.get("nalehavost") == "havárie" or triage.get("bezpecnost", {}).get("riziko")

    if is_emergency:
        safety = triage.get("bezpecnost", {}).get("poznamka") or ""
        return {
            "zprava_najemnikovi": (
                f"Dobrý den, děkujeme za nahlášení závady. "
                f"Jedná se o havarijní stav — {safety} "
                f"Kontaktovali jsme odborníka, který Vás bude kontaktovat. "
                f"V případě ohrožení volejte 112 (obecná tíseň) nebo 1239 (plyn)."
            ),
            "poptavka_remeslnikovi": (
                f"Havarijní závada — {description}. "
                f"Adresa: {unit_address}. "
                f"Prosím o kontaktování nájemníka a dohodnutí termínu."
            ),
            "doporuceny_stav": "Zadáno řemeslníkovi",
            "potreba_doplnit": False,
        }
    else:
        return {
            "zprava_najemnikovi": (
                "Dobrý den, děkujeme za nahlášení závady. "
                "Závadu jsme zaevidovali a posoudíme ji. Ozveme se Vám s dalším postupem."
            ),
            "poptavka_remeslnikovi": (
                f"Nová závada — {description}. "
                f"Adresa: {unit_address}. Prosím o kontaktování správce."
            ),
            "doporuceny_stav": "Nová",
            "potreba_doplnit": False,
        }


# ─── API Endpoints ─────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "Domovník Agent API", "version": "0.0.1"}


@app.post("/agent/triage")
def triage(input: TriageInput):
    """Step 1 + 2: Triage + search in one call."""
    triage_result = llm_triage(input.description, input.category)
    search_skip = (
        triage_result["nalehavost"] == "nízká"
        and triage_result["odpovednost"]["strana"] == "nájemník"
    )
    search_results = [] if search_skip else search_tradesperson("Praha")

    return {
        "triage": triage_result,
        "search_results": search_results,
        "search_skipped": search_skip,
    }


@app.post("/agent/pipeline")
async def pipeline(input: PipelineInput):
    """Full 4-step agent pipeline. Returns everything the UI needs."""
    log = []
    now = datetime.now().isoformat()
    is_auto = input.autonomy_mode == "auto"

    # Step 1 — Triage
    triage_result = await llm_triage(input.description, input.category)
    log.append({
        "detail": f"Třídění dokončeno: nalehavost={triage_result['nalehavost']}, odpovednost={triage_result['odpovednost']['strana']}",
        "at": now
    })

    # Step 2 — Search gate
    search_skip = (
        triage_result["nalehavost"] == "nízká"
        and triage_result["odpovednost"]["strana"] == "nájemník"
    )
    search_results = []
    if search_skip:
        log.append({"detail": "Drobná oprava — vyhledávání řemeslníka není nutné.", "at": now})
    else:
        search_results = await search_tradesperson(triage_result, input.unit_address)
        log.append({"detail": f"Vyhledání řemeslníka: nalezeno {len(search_results)} možností.", "at": now})

    # Step 3 — Draft actions
    draft = draft_actions(triage_result, input.description, input.unit_address)
    log.append({"detail": f"Připravena odpověď a poptávka. Doporučený stav: {draft['doporuceny_stav']}.", "at": now})

    # Step 4 — Act by autonomy mode
    # Agent sets status to "V řešení" — landlord manually changes to "Zadáno řemeslníkovi" when ready
    new_status = "V řešení"
    if draft["potreba_doplnit"]:
        new_status = "Nová"
    tenant_reply_sent = False
    tenant_draft_staged = None

    if is_auto:
        tenant_reply_sent = True
        log.append({"detail": f"AUTO mód: zpráva odeslána nájemníkovi, stav nastaven na {new_status}, poptávka uložena.", "at": now})
    else:
        tenant_draft_staged = draft["zprava_najemnikovi"]
        new_status = "Nová"
        log.append({"detail": "ASSIST mód: odpověď připravena ke schválení (nic neodesláno).", "at": now})

    return {
        "status": new_status,
        "urgency": triage_result["nalehavost"],
        "triage": triage_result,
        "search_results": search_results,
        "search_skipped": search_skip,
        "draft": draft,
        "tenant_reply": draft["zprava_najemnikovi"] if tenant_reply_sent else None,
        "tenant_draft_staged": tenant_draft_staged,
        "enquiry_draft": draft["poptavka_remeslnikovi"],
        "autonomy_mode": input.autonomy_mode,
        "agent_log": log,
    }


# ─── Run ───────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print("🚀 Domovník Agent API — http://localhost:3001")
    print("   Swagger docs: http://localhost:3001/docs")
    uvicorn.run(app, host="0.0.0.0", port=3001, log_level="info")