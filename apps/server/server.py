"""
Domovník Auth & Data API — Production server (FastAPI + SQLite).
Port 3002 — handles authentication, user data, and all CRUD operations.

Usage: python3 server.py
"""

import json, os, sqlite3, hashlib, secrets, time
from datetime import datetime, timedelta
import mimetypes
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "db", "domovnik.db")
JWT_SECRET = os.getenv("JWT_SECRET", "domovnik-dev-secret-key-2026")

app = FastAPI(title="Domovník API", version="0.0.1")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])



# ─── Database ─────────────────────────────────────────
def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with sqlite3.connect(DB_PATH) as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT,
                role TEXT, name TEXT, phone TEXT, locale TEXT DEFAULT 'cs-CZ',
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS tokens (token TEXT PRIMARY KEY, user_id TEXT, expires_at TEXT);
            CREATE TABLE IF NOT EXISTS units (
                id TEXT PRIMARY KEY, landlord_id TEXT, name TEXT, address TEXT,
                area_m2 REAL, type TEXT, created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS tenancies (
                id TEXT PRIMARY KEY, landlord_id TEXT, unit_id TEXT, tenant_user_id TEXT,
                tenant_name TEXT, phone TEXT, email TEXT, rent INTEGER,
                service_advances INTEGER, deposit INTEGER, variable_symbol TEXT,
                lease_start TEXT, lease_end TEXT, created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS payments (
                id TEXT PRIMARY KEY, landlord_id TEXT, tenancy_id TEXT, period TEXT,
                amount INTEGER, paid_date TEXT, method TEXT DEFAULT 'Prevod',
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS repair_requests (
                id TEXT PRIMARY KEY, landlord_id TEXT, unit_id TEXT, tenancy_id TEXT,
                category TEXT, description TEXT, full_description TEXT,
                status TEXT DEFAULT 'Nová', urgency TEXT DEFAULT 'střední',
                triage TEXT, search_results TEXT, enquiry_draft TEXT,
                tenant_draft TEXT, agent_log TEXT, created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY, repair_request_id TEXT, from_role TEXT,
                text TEXT, at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS inspections (
                id TEXT PRIMARY KEY, landlord_id TEXT, unit_id TEXT, type TEXT,
                due_date TEXT, done INTEGER DEFAULT 0, note TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS settlements (
                id TEXT PRIMARY KEY, landlord_id TEXT, unit_id TEXT, year INTEGER,
                tenant_name TEXT, advances_total INTEGER, costs TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS landlord_settings (
                id TEXT PRIMARY KEY, landlord_id TEXT UNIQUE, autonomy TEXT DEFAULT 'auto',
                notify_new INTEGER DEFAULT 1, notify_emergency INTEGER DEFAULT 1
            );
        """)
        db.commit()
init_db()

@contextmanager
def get_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    try: yield db
    finally: db.close()

# ─── Auth helpers ─────────────────────────────────────
def hash_password(pw: str) -> str:
    salt = secrets.token_hex(8)
    return salt + ":" + hashlib.sha256((salt + pw).encode()).hexdigest()

def verify_password(pw: str, stored: str) -> bool:
    salt, h = stored.split(":")
    return h == hashlib.sha256((salt + pw).encode()).hexdigest()

def create_token(user_id: str, hours: int = 24) -> str:
    token = secrets.token_hex(32)
    expires = (datetime.utcnow() + timedelta(hours=hours)).isoformat()
    with get_db() as db:
        db.execute("INSERT INTO tokens (token, user_id, expires_at) VALUES (?,?,?)", (token, user_id, expires))
        db.commit()
    return token

def verify_token(token: str) -> dict | None:
    with get_db() as db:
        row = db.execute("SELECT user_id, expires_at FROM tokens WHERE token=?", (token,)).fetchone()
        if not row: return None
        if datetime.fromisoformat(row["expires_at"]) < datetime.utcnow():
            db.execute("DELETE FROM tokens WHERE token=?", (token,)); db.commit()
            return None
        user = db.execute("SELECT * FROM users WHERE id=?", (row["user_id"],)).fetchone()
        return dict(user) if user else None

def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "): raise HTTPException(401, "Missing token")
    user = verify_token(auth[7:])
    if not user: raise HTTPException(401, "Invalid token")
    return user

# ─── Models ───────────────────────────────────────────
class RegisterInput(BaseModel):
    email: str; password: str; name: str; role: str = "LANDLORD"  # LANDLORD, TENANT, ADMIN

class LoginInput(BaseModel):
    email: str; password: str

class UnitInput(BaseModel):
    name: str; address: str; area_m2: float = 0; type: str = "Byt"

class TenancyInput(BaseModel):
    unit_id: str; tenant_name: str; phone: str = ""; email: str = ""
    rent: int = 0; service_advances: int = 0; deposit: int = 0
    variable_symbol: str = ""; lease_start: str = ""; lease_end: str = ""

class PaymentInput(BaseModel):
    tenancy_id: str; period: str; amount: int; paid_date: str = ""; method: str = "Prevod"

class RepairInput(BaseModel):
    unit_id: str = ""; tenancy_id: str = ""; category: str = "Jiné"
    description: str; full_description: str = ""

class MessageInput(BaseModel):
    from_role: str; text: str

class InspectionInput(BaseModel):
    unit_id: str; type: str; due_date: str; done: bool = False; note: str = ""

class SettlementInput(BaseModel):
    unit_id: str; year: int; tenant_name: str; advances_total: int = 0; costs: str = "[]"

# ─── Auth endpoints ───────────────────────────────────
@app.post("/auth/register")
def register(data: RegisterInput):
    with get_db() as db:
        if db.execute("SELECT id FROM users WHERE email=?", (data.email,)).fetchone():
            raise HTTPException(409, "Email již existuje")
        uid = secrets.token_hex(16)
        db.execute("INSERT INTO users (id,email,password_hash,role,name) VALUES (?,?,?,?,?)",
                   (uid, data.email, hash_password(data.password), data.role, data.name))
        if data.role == "LANDLORD":
            db.execute("INSERT INTO landlord_settings (id,landlord_id) VALUES (?,?)", (secrets.token_hex(8), uid))
        db.commit()
    token = create_token(uid)
    return {"access_token": token, "user": {"id": uid, "email": data.email, "role": data.role, "name": data.name}}

@app.post("/auth/login")
def login(data: LoginInput):
    with get_db() as db:
        user = db.execute("SELECT * FROM users WHERE email=?", (data.email,)).fetchone()
        if not user or not verify_password(data.password, user["password_hash"]):
            raise HTTPException(401, "Neplatný email nebo heslo")
    token = create_token(user["id"])
    return {"access_token": token, "user": {"id": user["id"], "email": user["email"], "role": user["role"], "name": user["name"]}}

@app.get("/auth/me")
def me(user: dict = Depends(get_current_user)):
    return {"user": user}

# ─── Seed demo data ───────────────────────────────────
@app.post("/auth/seed")
def seed_demo():
    with get_db() as db:
        # Create admin
        lhash = hash_password("heslo123")
        db.execute("INSERT OR IGNORE INTO users (id,email,password_hash,role,name) VALUES (?,?,?,?,?)",
                   ("admin-001", "admin@domovnik.cz", lhash, "ADMIN", "Administrátor"))
        # Create landlord
        lid = "landlord-001"
        db.execute("INSERT OR IGNORE INTO users (id,email,password_hash,role,name) VALUES (?,?,?,?,?)",
                   (lid, "jan.novak@email.cz", lhash, "LANDLORD", "Jan Novák"))
        db.execute("INSERT OR IGNORE INTO landlord_settings (id,landlord_id) VALUES (?,?)", ("ls-001", lid))
        # Create tenants
        for tid, email, name in [("tenant-001","petra@email.cz","Petra Nováková"), ("tenant-002","tereza@email.cz","Tereza Horáková"), ("tenant-003","martin@email.cz","Martin Dvořák")]:
            db.execute("INSERT OR IGNORE INTO users (id,email,password_hash,role,name) VALUES (?,?,?,?,?)",
                       (tid, email, hash_password("heslo123"), "TENANT", name))
        # Units
        units = [
            ("unit-001", lid, "Byt 2+kk", "Sokolovská 45, Praha 8", 62, "Byt"),
            ("unit-002", lid, "Byt 2+kk", "Veveří 12, Brno", 54, "Byt"),
            ("unit-003", lid, "Byt 3+1", "Jugoslávská 20, Praha 2", 78, "Byt"),
            ("unit-004", lid, "Dům", "Nad Lesem 5, Praha 4", 140, "Dům"),
        ]
        for u in units:
            db.execute("INSERT OR IGNORE INTO units (id,landlord_id,name,address,area_m2,type) VALUES (?,?,?,?,?,?)", u)
        # Tenancies
        tenancies = [
            ("ten-001", lid, "unit-001", "tenant-001", "Petra Nováková", "", "petra@email.cz", 20000, 1700, 40000, "1201", "2026-01-01", ""),
            ("ten-002", lid, "unit-002", "tenant-002", "Tereza Horáková", "", "tereza@email.cz", 13900, 2000, 27800, "3304", "2026-01-01", ""),
            ("ten-003", lid, "unit-003", "tenant-003", "Martin Dvořák", "", "martin@email.cz", 26100, 2000, 52200, "8802", "2026-01-01", ""),
        ]
        for t in tenancies:
            db.execute("INSERT OR IGNORE INTO tenancies (id,landlord_id,unit_id,tenant_user_id,tenant_name,phone,email,rent,service_advances,deposit,variable_symbol,lease_start,lease_end) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", t)
        # Payments
        for p in [
            ("pay-001", lid, "ten-001", "2026-07", 21700, "2026-07-05", "Prevod"),
            ("pay-002", lid, "ten-002", "2026-07", 15900, "", "Prevod"),
            ("pay-003", lid, "ten-003", "2026-07", 28100, "", "Prevod"),
        ]:
            db.execute("INSERT OR IGNORE INTO payments (id,landlord_id,tenancy_id,period,amount,paid_date,method) VALUES (?,?,?,?,?,?,?)", p)
        # Inspections
        for i in [
            ("ins-001", lid, "unit-004", "Kontrola komína", "2024-08-03", 0, "Naléhavé!"),
            ("ins-002", lid, "unit-002", "Revize plynu", "2026-08-15", 1, ""),
            ("ins-003", lid, "unit-003", "Revize elektroinstalace", "2026-12-20", 0, ""),
            ("ins-004", lid, "unit-004", "Revize hasicího přístroje", "2027-01-10", 0, ""),
        ]:
            db.execute("INSERT OR IGNORE INTO inspections (id,landlord_id,unit_id,type,due_date,done,note) VALUES (?,?,?,?,?,?,?)", i)
        # Repair requests
        rr = [
            ("rr-001", lid, "unit-001", "ten-001", "Voda a odpad", "Prasklá hadička", "Praskla přívodní hadička k pračce, na podlaze je voda.", "V řešení", "havárie"),
            ("rr-002", lid, "unit-003", "ten-003", "Topení", "Netopí topení", "V obývacím pokoji je zima, topení je studené.", "Nová", "vysoká"),
            ("rr-003", lid, "unit-002", "ten-002", "Zámky a klíče", "Uvolněná klika", "Klika se protáčí, nejdou otevřít.", "V řešení", "nízká"),
        ]
        for r in rr:
            db.execute("INSERT OR IGNORE INTO repair_requests (id,landlord_id,unit_id,tenancy_id,category,description,full_description,status,urgency) VALUES (?,?,?,?,?,?,?,?,?)", r)
        # Messages for rr-001
        for m in [
            ("msg-001", "rr-001", "najemnik", "Praskla přívodní hadička, na podlaze je voda.", "2026-07-15 14:23"),
            ("msg-002", "rr-001", "asistent", "Dobrý den, závadu jsme vyhodnotili jako havarijní. Zavřete přívod vody a odpojte pračku.", "2026-07-15 15:02"),
        ]:
            db.execute("INSERT OR IGNORE INTO messages (id,repair_request_id,from_role,text,at) VALUES (?,?,?,?,?)", m)
        db.commit()
    return {"seeded": True, "accounts": [
        {"email":"admin@domovnik.cz","role":"ADMIN"},
        {"email":"jan.novak@email.cz","role":"LANDLORD"},
        {"email":"petra@email.cz","role":"TENANT"},
        {"email":"tereza@email.cz","role":"TENANT"},
        {"email":"martin@email.cz","role":"TENANT"}
    ], "password": "heslo123"}

# ─── CRUD: Units ──────────────────────────────────────
@app.get("/api/units")
def list_units(user: dict = Depends(get_current_user)):
    with get_db() as db:
        if user["role"] == "ADMIN":
            rows = db.execute("SELECT * FROM units ORDER BY name").fetchall()
        else:
            rows = db.execute("SELECT * FROM units WHERE landlord_id=? ORDER BY name", (user["id"],)).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/units")
def create_unit(data: UnitInput, user: dict = Depends(get_current_user)):
    if user["role"] != "LANDLORD": raise HTTPException(403, "Nedostatečná oprávnění")
    uid = secrets.token_hex(8)
    with get_db() as db:
        db.execute("INSERT INTO units (id,landlord_id,name,address,area_m2,type) VALUES (?,?,?,?,?,?)",
                   (uid, user["id"], data.name, data.address, data.area_m2, data.type)); db.commit()
        return dict(db.execute("SELECT * FROM units WHERE id=?", (uid,)).fetchone())

@app.put("/api/units/{uid}")
def update_unit(uid: str, data: UnitInput, user: dict = Depends(get_current_user)):
    with get_db() as db:
        db.execute("UPDATE units SET name=?,address=?,area_m2=?,type=? WHERE id=? AND landlord_id=?",
                   (data.name, data.address, data.area_m2, data.type, uid, user["id"])); db.commit()
        return dict(db.execute("SELECT * FROM units WHERE id=?", (uid,)).fetchone())

@app.delete("/api/units/{uid}")
def delete_unit(uid: str, user: dict = Depends(get_current_user)):
    with get_db() as db:
        db.execute("DELETE FROM units WHERE id=? AND landlord_id=?", (uid, user["id"])); db.commit()
    return {"deleted": True}

# ─── CRUD: Tenancies ──────────────────────────────────
@app.get("/api/tenancies")
def list_tenancies(user: dict = Depends(get_current_user)):
    with get_db() as db:
        if user["role"] == "TENANT":
            rows = db.execute("SELECT * FROM tenancies WHERE tenant_user_id=?", (user["id"],)).fetchall()
        else:
            rows = db.execute("SELECT * FROM tenancies WHERE landlord_id=? ORDER BY tenant_name", (user["id"],)).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/tenancies")
def create_tenancy(data: TenancyInput, user: dict = Depends(get_current_user)):
    if user["role"] != "LANDLORD": raise HTTPException(403)
    tid = secrets.token_hex(8)
    with get_db() as db:
        db.execute("INSERT INTO tenancies (id,landlord_id,unit_id,tenant_name,phone,email,rent,service_advances,deposit,variable_symbol,lease_start,lease_end) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                   (tid, user["id"], data.unit_id, data.tenant_name, data.phone, data.email, data.rent, data.service_advances, data.deposit, data.variable_symbol, data.lease_start, data.lease_end)); db.commit()
        return dict(db.execute("SELECT * FROM tenancies WHERE id=?", (tid,)).fetchone())

@app.put("/api/tenancies/{tid}")
def update_tenancy(tid: str, data: TenancyInput, user: dict = Depends(get_current_user)):
    with get_db() as db:
        db.execute("UPDATE tenancies SET unit_id=?,tenant_name=?,phone=?,email=?,rent=?,service_advances=?,deposit=?,variable_symbol=?,lease_start=?,lease_end=? WHERE id=? AND landlord_id=?",
                   (data.unit_id, data.tenant_name, data.phone, data.email, data.rent, data.service_advances, data.deposit, data.variable_symbol, data.lease_start, data.lease_end, tid, user["id"])); db.commit()
        return dict(db.execute("SELECT * FROM tenancies WHERE id=?", (tid,)).fetchone())

@app.delete("/api/tenancies/{tid}")
def delete_tenancy(tid: str, user: dict = Depends(get_current_user)):
    with get_db() as db:
        db.execute("DELETE FROM tenancies WHERE id=? AND landlord_id=?", (tid, user["id"])); db.commit()
    return {"deleted": True}

# ─── CRUD: Payments ───────────────────────────────────
@app.get("/api/payments")
def list_payments(tenancy_id: str = "", period: str = "", user: dict = Depends(get_current_user)):
    with get_db() as db:
        if user["role"] == "TENANT":
            rows = db.execute("SELECT p.* FROM payments p JOIN tenancies t ON p.tenancy_id=t.id WHERE t.tenant_user_id=? " +
                              ("AND p.tenancy_id=?" if tenancy_id else "") + ("AND p.period=?" if period else "") + " ORDER BY p.period DESC",
                              tuple([user["id"]] + ([tenancy_id] if tenancy_id else []) + ([period] if period else []))).fetchall()
        else:
            q = "SELECT * FROM payments WHERE landlord_id=?"
            params = [user["id"]]
            if tenancy_id: q += " AND tenancy_id=?"; params.append(tenancy_id)
            if period: q += " AND period=?"; params.append(period)
            q += " ORDER BY period DESC"
            rows = db.execute(q, params).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/payments")
def create_payment(data: PaymentInput, user: dict = Depends(get_current_user)):
    pid = secrets.token_hex(8)
    with get_db() as db:
        db.execute("INSERT INTO payments (id,landlord_id,tenancy_id,period,amount,paid_date,method) VALUES (?,?,?,?,?,?,?)",
                   (pid, user["id"], data.tenancy_id, data.period, data.amount, data.paid_date or "", data.method)); db.commit()
        return dict(db.execute("SELECT * FROM payments WHERE id=?", (pid,)).fetchone())

# ─── CRUD: Repair Requests ────────────────────────────
@app.get("/api/repair-requests")
def list_repairs(user: dict = Depends(get_current_user)):
    with get_db() as db:
        if user["role"] == "TENANT":
            rows = db.execute("SELECT r.* FROM repair_requests r JOIN tenancies t ON r.tenancy_id=t.id WHERE t.tenant_user_id=? ORDER BY r.created_at DESC", (user["id"],)).fetchall()
        else:
            rows = db.execute("SELECT * FROM repair_requests WHERE landlord_id=? ORDER BY created_at DESC", (user["id"],)).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            msgs = db.execute("SELECT * FROM messages WHERE repair_request_id=? ORDER BY at", (r["id"],)).fetchall()
            d["messages"] = [dict(m) for m in msgs]
            results.append(d)
        return results

@app.post("/api/repair-requests")
def create_repair(data: RepairInput, user: dict = Depends(get_current_user)):
    rid = secrets.token_hex(8)
    with get_db() as db:
        if user["role"] == "TENANT":
            tenancy = db.execute("SELECT * FROM tenancies WHERE tenant_user_id=?", (user["id"],)).fetchone()
            if not tenancy: raise HTTPException(404, "Nájemní smlouva nenalezena")
            unit_id = tenancy["unit_id"]
            tenancy_id = tenancy["id"]
            landlord_id = tenancy["landlord_id"]
        else:
            unit_id = data.unit_id
            tenancy_id = data.tenancy_id
            landlord_id = user["id"]
        db.execute("INSERT INTO repair_requests (id,landlord_id,unit_id,tenancy_id,category,description,full_description,status) VALUES (?,?,?,?,?,?,?,'Zpracovává se')",
                   (rid, landlord_id, unit_id, tenancy_id, data.category, data.description, data.full_description or data.description))
        # Add initial message
        db.execute("INSERT INTO messages (id,repair_request_id,from_role,text) VALUES (?,?,?,'najemnik',?)",
                   (secrets.token_hex(8), rid, "najemnik", data.description))
        db.commit()
        return dict(db.execute("SELECT * FROM repair_requests WHERE id=?", (rid,)).fetchone())

@app.put("/api/repair-requests/{rid}")
def update_repair(rid: str, data: dict, user: dict = Depends(get_current_user)):
    with get_db() as db:
        if "status" in data:
            db.execute("UPDATE repair_requests SET status=? WHERE id=?", (data["status"], rid))
        if "urgency" in data:
            db.execute("UPDATE repair_requests SET urgency=? WHERE id=?", (data["urgency"], rid))
        if "triage" in data:
            db.execute("UPDATE repair_requests SET triage=? WHERE id=?", (json.dumps(data["triage"]), rid))
        if "enquiry_draft" in data:
            db.execute("UPDATE repair_requests SET enquiry_draft=? WHERE id=?", (data["enquiry_draft"], rid))
        if "search_results" in data:
            db.execute("UPDATE repair_requests SET search_results=? WHERE id=?", (json.dumps(data["search_results"]), rid))
        db.commit()
        return dict(db.execute("SELECT * FROM repair_requests WHERE id=?", (rid,)).fetchone())

# ─── CRUD: Messages ───────────────────────────────────
@app.get("/api/messages/{repair_id}")
def list_messages(repair_id: str, user: dict = Depends(get_current_user)):
    with get_db() as db:
        rows = db.execute("SELECT * FROM messages WHERE repair_request_id=? ORDER BY at", (repair_id,)).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/messages/{repair_id}")
def create_message(repair_id: str, data: MessageInput, user: dict = Depends(get_current_user)):
    mid = secrets.token_hex(8)
    with get_db() as db:
        db.execute("INSERT INTO messages (id,repair_request_id,from_role,text) VALUES (?,?,?,?)",
                   (mid, repair_id, data.from_role, data.text)); db.commit()
        return dict(db.execute("SELECT * FROM messages WHERE id=?", (mid,)).fetchone())

# ─── Inspections ──────────────────────────────────────
@app.get("/api/inspections")
def list_inspections(user: dict = Depends(get_current_user)):
    with get_db() as db:
        rows = db.execute("SELECT * FROM inspections WHERE landlord_id=? ORDER BY done ASC, due_date ASC", (user["id"],)).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/inspections")
def create_inspection(data: InspectionInput, user: dict = Depends(get_current_user)):
    iid = secrets.token_hex(8)
    with get_db() as db:
        db.execute("INSERT INTO inspections (id,landlord_id,unit_id,type,due_date,done,note) VALUES (?,?,?,?,?,?,?)",
                   (iid, user["id"], data.unit_id, data.type, data.due_date, 1 if data.done else 0, data.note)); db.commit()
        return dict(db.execute("SELECT * FROM inspections WHERE id=?", (iid,)).fetchone())

# ─── Admin ────────────────────────────────────────────
@app.get("/api/admin/overview")
def admin_overview(user: dict = Depends(get_current_user)):
    if user["role"] != "ADMIN": raise HTTPException(403, "Admin only — requires ADMIN role")
    with get_db() as db:
        # GLOBAL view: all users, all units, all tenancies regardless of landlord
        users = db.execute("SELECT id, email, role, name, phone, created_at FROM users").fetchall()
        units = db.execute("SELECT * FROM units ORDER BY name").fetchall()
        tenancies = db.execute("""
            SELECT t.*, u.name as unit_name, u.address as unit_address,
                   l.email as landlord_email, l.name as landlord_name
            FROM tenancies t 
            JOIN units u ON t.unit_id = u.id 
            LEFT JOIN users l ON t.landlord_id = l.id
            ORDER BY t.tenant_name
        """).fetchall()
        payments = db.execute("SELECT * FROM payments ORDER BY period DESC").fetchall()
        repair_requests = db.execute("SELECT * FROM repair_requests ORDER BY created_at DESC").fetchall()
        inspections = db.execute("SELECT * FROM inspections ORDER BY done ASC, due_date ASC").fetchall()
        settings = db.execute("SELECT * FROM landlord_settings").fetchall()
        
        return {
            "users": [dict(r) for r in users],
            "units": [dict(r) for r in units],
            "tenancies": [dict(r) for r in tenancies],
            "payments": [dict(r) for r in payments],
            "repair_requests": [dict(r) for r in repair_requests],
            "inspections": [dict(r) for r in inspections],
            "settings": [dict(r) for r in settings],
            "stats": {
                "total_units": len(units),
                "total_tenancies": len(tenancies),
                "total_users": len(users),
                "total_landlords": sum(1 for r in users if dict(r)["role"] == "LANDLORD"),
                "total_tenants": sum(1 for r in users if dict(r)["role"] == "TENANT"),
                "open_requests": sum(1 for r in repair_requests if dict(r)["status"] != "Vyřešeno")
            }
        }

# ─── Settings ─────────────────────────────────────────
@app.get("/api/settings")
def get_settings(user: dict = Depends(get_current_user)):
    with get_db() as db:
        row = db.execute("SELECT * FROM landlord_settings WHERE landlord_id=?", (user["id"],)).fetchone()
        return dict(row) if row else {}

@app.put("/api/settings")
def update_settings(data: dict, user: dict = Depends(get_current_user)):
    with get_db() as db:
        for k, v in data.items():
            db.execute(f"UPDATE landlord_settings SET {k}=? WHERE landlord_id=?", (v, user["id"]))
        db.commit()
        row = db.execute("SELECT * FROM landlord_settings WHERE landlord_id=?", (user["id"],)).fetchone()
        return dict(row)

# ─── Health check ─────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "version": "0.0.1"}

# ─── Static file serving (MUST BE LAST — catches only non-API paths) ──
# Auto-detect static dir
def _find_static_dir():
    dirs = [
        os.path.join(os.path.dirname(__file__), "..", "..", "apps", "desktop"),  # local dev
        os.path.join(os.path.dirname(__file__), "static"),  # Docker /app/static
    ]
    for d in dirs:
        if os.path.isdir(d) and os.path.isfile(os.path.join(d, "login.html")):
            return d
    return dirs[-1]  # fallback

STATIC_DIR = _find_static_dir()

@app.get("/{filename:path}")
async def serve_static(filename: str):
    if filename.startswith("api/") or filename.startswith("auth/") or filename == "health":
        raise HTTPException(404, "Not found")
    filepath = os.path.join(STATIC_DIR, filename)
    if os.path.isfile(filepath):
        mt = mimetypes.guess_type(filepath)[0] or "text/html"
        return FileResponse(filepath, media_type=mt)
    return HTMLResponse("<h1>Domovník — 404 Not Found</h1>", status_code=404)

@app.get("/")
async def serve_root():
    filepath = os.path.join(STATIC_DIR, "login.html")
    if os.path.isfile(filepath):
        return FileResponse(filepath, media_type="text/html")
    return HTMLResponse("<h1>Domovník — 404 Not Found</h1>", status_code=404)

# ─── Run ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print("🚀 Domovník API server — http://localhost:3002")
    print("   POST /auth/seed to populate demo data")
    uvicorn.run(app, host="0.0.0.0", port=3002, log_level="info")
