from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta, date
import uuid
import logging
import jwt
import bcrypt
from bson import ObjectId

# ---------------- DB ----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"

# ---------------- Auth helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ---------------- Models ----------------
class LoginInput(BaseModel):
    email: str
    password: str

class Shop(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shop_no: str
    name: str
    district: str
    location: str
    supervisor: str = ""
    contact: str = ""
    cycle_days: int = 5
    active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ShopCreate(BaseModel):
    shop_no: str
    name: str
    district: str
    location: str
    supervisor: str = ""
    contact: str = ""
    cycle_days: int = 5

class ShopUpdate(BaseModel):
    shop_no: Optional[str] = None
    name: Optional[str] = None
    district: Optional[str] = None
    location: Optional[str] = None
    supervisor: Optional[str] = None
    contact: Optional[str] = None
    cycle_days: Optional[int] = None
    active: Optional[bool] = None

class BoxEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shop_id: str
    shop_no: str
    shop_name: str
    quantity: int          # cotton boxes in PCS
    waste_kg: float        # quantity / 12
    entry_date: str        # ISO date
    notes: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BoxEntryCreate(BaseModel):
    shop_id: str
    quantity: int
    entry_date: Optional[str] = None
    notes: str = ""

class InvoiceItem(BaseModel):
    description: str = "Cotton Box (Corrugated Paperboard)"
    hsn: str = "4819"
    unit: str = "PCS"
    quantity: float
    rate: float

class InvoiceCreate(BaseModel):
    shop_id: str
    invoice_date: Optional[str] = None
    items: List[InvoiceItem]
    cgst_percent: float = 9.0
    sgst_percent: float = 9.0

class SettingsModel(BaseModel):
    company_name: str = "Auro Products"
    gstin: str = "33AITPM1982E1Z1"
    address: str = "52 B 52c, Viswas Nagar 2nd Main Road, Tiruchirappalli, Trichy, Tamil Nadu - 625007"
    state: str = "Tamil Nadu"
    state_code: str = "33"
    phone: str = ""
    email: str = "bmartbuild4@gmail.com"
    hsn_code: str = "4819"
    default_rate: float = 16.0
    cgst_percent: float = 9.0
    sgst_percent: float = 9.0
    waste_divisor: int = 12
    bank_name: str = ""
    account_no: str = ""
    ifsc: str = ""
    tender_ref: str = ""
    terms: str = "Goods once sold will not be taken back. Payment due within 7 days."

# ---------------- Auth endpoints ----------------
@api_router.post("/auth/login")
async def login(data: LoginInput):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(str(user["_id"]), email)
    return {"token": token, "user": {"id": str(user["_id"]), "email": email, "name": user.get("name", "Admin"), "role": user.get("role", "admin")}}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# ---------------- Settings ----------------
async def get_settings_doc() -> dict:
    doc = await db.settings.find_one({"_id": "singleton"})
    if not doc:
        s = SettingsModel().model_dump()
        s["_id"] = "singleton"
        await db.settings.insert_one(s)
        doc = s
    doc.pop("_id", None)
    return doc

@api_router.get("/settings")
async def read_settings(user: dict = Depends(get_current_user)):
    return await get_settings_doc()

@api_router.put("/settings")
async def update_settings(data: SettingsModel, user: dict = Depends(get_current_user)):
    payload = data.model_dump()
    await db.settings.update_one({"_id": "singleton"}, {"$set": payload}, upsert=True)
    return payload

# ---------------- Shops ----------------
@api_router.get("/shops")
async def list_shops(search: str = "", district: str = "", user: dict = Depends(get_current_user)):
    query = {}
    if search:
        query["$or"] = [
            {"shop_no": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}},
            {"location": {"$regex": search, "$options": "i"}},
            {"district": {"$regex": search, "$options": "i"}},
        ]
    if district:
        query["district"] = district
    shops = await db.shops.find(query, {"_id": 0}).sort("shop_no", 1).to_list(1000)
    return shops

@api_router.get("/shops/districts")
async def list_districts(user: dict = Depends(get_current_user)):
    return await db.shops.distinct("district")

@api_router.post("/shops")
async def create_shop(data: ShopCreate, user: dict = Depends(get_current_user)):
    shop = Shop(**data.model_dump())
    await db.shops.insert_one(shop.model_dump())
    return shop.model_dump()

@api_router.put("/shops/{shop_id}")
async def update_shop(shop_id: str, data: ShopUpdate, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    await db.shops.update_one({"id": shop_id}, {"$set": update})
    doc = await db.shops.find_one({"id": shop_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Shop not found")
    return doc

@api_router.delete("/shops/{shop_id}")
async def delete_shop(shop_id: str, user: dict = Depends(get_current_user)):
    await db.shops.delete_one({"id": shop_id})
    return {"ok": True}

# ---------------- Box Entries ----------------
@api_router.get("/entries")
async def list_entries(shop_id: str = "", start: str = "", end: str = "", user: dict = Depends(get_current_user)):
    query = {}
    if shop_id:
        query["shop_id"] = shop_id
    if start or end:
        rng = {}
        if start:
            rng["$gte"] = start
        if end:
            rng["$lte"] = end + "T23:59:59"
        query["entry_date"] = rng
    entries = await db.entries.find(query, {"_id": 0}).sort("entry_date", -1).to_list(2000)
    return entries

@api_router.post("/entries")
async def create_entry(data: BoxEntryCreate, user: dict = Depends(get_current_user)):
    shop = await db.shops.find_one({"id": data.shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    settings = await get_settings_doc()
    divisor = settings.get("waste_divisor", 12) or 12
    waste = round(data.quantity / divisor, 2)
    entry = BoxEntry(
        shop_id=shop["id"], shop_no=shop["shop_no"], shop_name=shop["name"],
        quantity=data.quantity, waste_kg=waste,
        entry_date=data.entry_date or datetime.now(timezone.utc).isoformat(),
        notes=data.notes,
    )
    await db.entries.insert_one(entry.model_dump())
    return entry.model_dump()

@api_router.delete("/entries/{entry_id}")
async def delete_entry(entry_id: str, user: dict = Depends(get_current_user)):
    await db.entries.delete_one({"id": entry_id})
    return {"ok": True}

# ---------------- Invoices ----------------
async def next_invoice_no() -> str:
    counter = await db.counters.find_one_and_update(
        {"_id": "invoice"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True)
    seq = counter["seq"] if counter and "seq" in counter else 1
    return f"AP{600 + seq}"

@api_router.get("/invoices")
async def list_invoices(search: str = "", start: str = "", end: str = "", user: dict = Depends(get_current_user)):
    query = {}
    if search:
        query["$or"] = [
            {"invoice_no": {"$regex": search, "$options": "i"}},
            {"shop_name": {"$regex": search, "$options": "i"}},
            {"shop_no": {"$regex": search, "$options": "i"}},
        ]
    if start or end:
        rng = {}
        if start:
            rng["$gte"] = start
        if end:
            rng["$lte"] = end + "T23:59:59"
        query["invoice_date"] = rng
    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return invoices

@api_router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    doc = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return doc

@api_router.post("/invoices")
async def create_invoice(data: InvoiceCreate, user: dict = Depends(get_current_user)):
    shop = await db.shops.find_one({"id": data.shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    settings = await get_settings_doc()
    line_items = []
    taxable = 0.0
    for it in data.items:
        amount = round(it.quantity * it.rate, 2)
        taxable += amount
        line_items.append({**it.model_dump(), "amount": amount})
    taxable = round(taxable, 2)
    cgst = round(taxable * data.cgst_percent / 100, 2)
    sgst = round(taxable * data.sgst_percent / 100, 2)
    total_before_round = taxable + cgst + sgst
    grand_total = round(total_before_round)
    round_off = round(grand_total - total_before_round, 2)
    inv_no = await next_invoice_no()
    invoice = {
        "id": str(uuid.uuid4()),
        "invoice_no": inv_no,
        "invoice_date": data.invoice_date or datetime.now(timezone.utc).isoformat(),
        "shop_id": shop["id"],
        "shop_no": shop["shop_no"],
        "shop_name": shop["name"],
        "shop_district": shop.get("district", ""),
        "shop_location": shop.get("location", ""),
        "items": line_items,
        "taxable": taxable,
        "cgst_percent": data.cgst_percent,
        "sgst_percent": data.sgst_percent,
        "cgst": cgst,
        "sgst": sgst,
        "round_off": round_off,
        "grand_total": grand_total,
        "seller": {
            "name": settings.get("company_name"),
            "gstin": settings.get("gstin"),
            "address": settings.get("address"),
            "state": settings.get("state"),
            "state_code": settings.get("state_code"),
            "phone": settings.get("phone"),
            "email": settings.get("email"),
            "bank_name": settings.get("bank_name"),
            "account_no": settings.get("account_no"),
            "ifsc": settings.get("ifsc"),
            "terms": settings.get("terms"),
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.invoices.insert_one({**invoice})
    invoice.pop("_id", None)
    return invoice

@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    await db.invoices.delete_one({"id": invoice_id})
    return {"ok": True}

# ---------------- Dashboard / Reminders ----------------
def parse_iso(s: str) -> datetime:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)

@api_router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    shops = await db.shops.find({"active": True}, {"_id": 0}).to_list(1000)
    entries = await db.entries.find({}, {"_id": 0}).to_list(5000)
    last_by_shop = {}
    for e in entries:
        sid = e["shop_id"]
        d = parse_iso(e["entry_date"])
        if sid not in last_by_shop or d > last_by_shop[sid]:
            last_by_shop[sid] = d
    today = datetime.now(timezone.utc).date()
    reminders = []
    due_today = overdue = upcoming = 0
    for s in shops:
        last = last_by_shop.get(s["id"])
        if last:
            next_date = (last + timedelta(days=s.get("cycle_days", 5))).date()
            days_left = (next_date - today).days
            if days_left < 0:
                status = "overdue"; overdue += 1
            elif days_left == 0:
                status = "due_today"; due_today += 1
            else:
                status = "upcoming"; upcoming += 1
            last_str = last.date().isoformat()
        else:
            next_date = today
            days_left = 0
            status = "no_entry"
            last_str = None
        reminders.append({
            "shop_id": s["id"], "shop_no": s["shop_no"], "shop_name": s["name"],
            "district": s.get("district", ""), "location": s.get("location", ""),
            "cycle_days": s.get("cycle_days", 5),
            "last_entry": last_str, "next_pickup": next_date.isoformat(),
            "days_left": days_left, "status": status,
        })
    order = {"overdue": 0, "due_today": 1, "no_entry": 2, "upcoming": 3}
    reminders.sort(key=lambda r: (order.get(r["status"], 4), r["days_left"]))

    invoices = await db.invoices.find({}, {"_id": 0}).to_list(5000)
    total_revenue = round(sum(i.get("grand_total", 0) for i in invoices), 2)
    total_boxes = sum(e.get("quantity", 0) for e in entries)
    total_waste = round(sum(e.get("waste_kg", 0) for e in entries), 2)
    return {
        "stats": {
            "total_shops": len(shops),
            "total_boxes": total_boxes,
            "total_waste_kg": total_waste,
            "total_revenue": total_revenue,
            "total_invoices": len(invoices),
            "overdue": overdue, "due_today": due_today, "upcoming": upcoming,
        },
        "reminders": reminders,
    }

@api_router.get("/analytics/waste")
async def waste_analytics(user: dict = Depends(get_current_user)):
    entries = await db.entries.find({}, {"_id": 0}).to_list(5000)
    by_shop = {}
    by_month = {}
    for e in entries:
        key = e["shop_no"] + " - " + e["shop_name"]
        by_shop.setdefault(key, {"boxes": 0, "waste": 0.0})
        by_shop[key]["boxes"] += e.get("quantity", 0)
        by_shop[key]["waste"] += e.get("waste_kg", 0)
        month = parse_iso(e["entry_date"]).strftime("%Y-%m")
        by_month.setdefault(month, {"boxes": 0, "waste": 0.0})
        by_month[month]["boxes"] += e.get("quantity", 0)
        by_month[month]["waste"] += e.get("waste_kg", 0)
    shop_rows = [{"shop": k, "boxes": v["boxes"], "waste": round(v["waste"], 2)} for k, v in by_shop.items()]
    shop_rows.sort(key=lambda x: x["waste"], reverse=True)
    month_rows = [{"month": k, "boxes": v["boxes"], "waste": round(v["waste"], 2)} for k, v in sorted(by_month.items())]
    return {"by_shop": shop_rows, "by_month": month_rows}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------- Seed ----------------
TN_DISTRICTS = [
    ("Chennai", ["Anna Nagar", "T Nagar", "Adyar", "Velachery", "Tambaram", "Guindy", "Perambur", "Egmore"]),
    ("Coimbatore", ["Gandhipuram", "RS Puram", "Peelamedu", "Saibaba Colony", "Ukkadam"]),
    ("Madurai", ["Anna Nagar", "KK Nagar", "Simmakkal", "Goripalayam", "Mattuthavani"]),
    ("Trichy", ["Srirangam", "Thillai Nagar", "Woraiyur", "KK Nagar", "Cantonment"]),
    ("Salem", ["Fairlands", "Hasthampatti", "Ammapet", "Suramangalam"]),
    ("Erode", ["Karungalpalayam", "Surampatti", "Perundurai", "Gobichettipalayam"]),
    ("Tirunelveli", ["Palayamkottai", "Town", "Melapalayam", "Vannarpettai"]),
    ("Vellore", ["Katpadi", "Gandhi Nagar", "Sathuvachari"]),
    ("Thanjavur", ["Medical College Road", "New Bus Stand", "Gandhiji Road"]),
    ("Tiruppur", ["Kumaran Road", "Avinashi Road", "Dharapuram"]),
    ("Dindigul", ["Palani Road", "Begambur", "Nagal Nagar"]),
    ("Kanchipuram", ["Little Kanchipuram", "Gandhi Road"]),
]

async def seed_shops():
    count = await db.shops.count_documents({})
    if count >= 149:
        return
    await db.shops.delete_many({})
    docs = []
    n = 0
    idx = 0
    while n < 149:
        district, areas = TN_DISTRICTS[idx % len(TN_DISTRICTS)]
        area = areas[(n // len(TN_DISTRICTS)) % len(areas)]
        shop_no = f"TN{1001 + n}"
        cycle = 2 if n % 6 == 0 else 5
        shop = Shop(
            shop_no=shop_no,
            name=f"TASMAC Shop {1001 + n}",
            district=district,
            location=f"{area}, {district}",
            supervisor="",
            contact="",
            cycle_days=cycle,
        )
        docs.append(shop.model_dump())
        n += 1
        idx += 1
    await db.shops.insert_many(docs)
    logger.info(f"Seeded {len(docs)} shops")

async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email, "password_hash": hash_password(admin_password),
            "name": "Auro Admin", "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Admin seeded")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await seed_admin()
    await seed_shops()
    await get_settings_doc()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
