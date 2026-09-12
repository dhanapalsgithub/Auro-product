from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Header, UploadFile, File, BackgroundTasks
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta, date
import uuid
import logging
import jwt
import bcrypt
import hmac
import io
import re
import ipaddress
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from bson import ObjectId
import openpyxl

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
    opening_balance: float = 0.0
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
    opening_balance: float = 0.0

class ShopUpdate(BaseModel):
    shop_no: Optional[str] = None
    name: Optional[str] = None
    district: Optional[str] = None
    location: Optional[str] = None
    supervisor: Optional[str] = None
    contact: Optional[str] = None
    cycle_days: Optional[int] = None
    opening_balance: Optional[float] = None
    active: Optional[bool] = None

class PaymentCreate(BaseModel):
    shop_id: str
    invoice_id: Optional[str] = None
    amount: float
    mode: str = "Cash"
    payment_date: Optional[str] = None
    notes: str = ""

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
    upi_id: str = ""
    reminder_email: str = "bmartbuild4@gmail.com"
    reminder_whatsapp: str = ""
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
        "amount_paid": 0.0,
        "balance": grand_total,
        "status": "unpaid",
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
            "upi_id": settings.get("upi_id"),
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

# ---------------- Payments & Ledger ----------------
async def recompute_invoice(invoice_id: str):
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        return
    paid = 0.0
    async for p in db.payments.find({"invoice_id": invoice_id}):
        paid += p.get("amount", 0)
    paid = round(paid, 2)
    balance = round(inv["grand_total"] - paid, 2)
    status = "paid" if balance <= 0.01 else ("partial" if paid > 0 else "unpaid")
    await db.invoices.update_one({"id": invoice_id}, {"$set": {"amount_paid": paid, "balance": balance, "status": status}})

@api_router.get("/payments")
async def list_payments(shop_id: str = "", start: str = "", end: str = "", user: dict = Depends(get_current_user)):
    query = {}
    if shop_id:
        query["shop_id"] = shop_id
    if start or end:
        rng = {}
        if start:
            rng["$gte"] = start
        if end:
            rng["$lte"] = end + "T23:59:59"
        query["payment_date"] = rng
    payments = await db.payments.find(query, {"_id": 0}).sort("payment_date", -1).to_list(3000)
    return payments

@api_router.post("/payments")
async def create_payment(data: PaymentCreate, user: dict = Depends(get_current_user)):
    shop = await db.shops.find_one({"id": data.shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    inv_no = ""
    if data.invoice_id:
        inv = await db.invoices.find_one({"id": data.invoice_id}, {"_id": 0})
        inv_no = inv["invoice_no"] if inv else ""
    payment = {
        "id": str(uuid.uuid4()),
        "shop_id": shop["id"], "shop_no": shop["shop_no"], "shop_name": shop["name"],
        "invoice_id": data.invoice_id or "", "invoice_no": inv_no,
        "amount": round(data.amount, 2), "mode": data.mode,
        "payment_date": data.payment_date or datetime.now(timezone.utc).isoformat(),
        "notes": data.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payments.insert_one({**payment})
    payment.pop("_id", None)
    if data.invoice_id:
        await recompute_invoice(data.invoice_id)
    return payment

@api_router.delete("/payments/{payment_id}")
async def delete_payment(payment_id: str, user: dict = Depends(get_current_user)):
    p = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    await db.payments.delete_one({"id": payment_id})
    if p and p.get("invoice_id"):
        await recompute_invoice(p["invoice_id"])
    return {"ok": True}

@api_router.get("/ledger/{shop_id}")
async def shop_ledger(shop_id: str, user: dict = Depends(get_current_user)):
    shop = await db.shops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    opening = shop.get("opening_balance", 0.0)
    invoices = await db.invoices.find({"shop_id": shop_id}, {"_id": 0}).to_list(2000)
    payments = await db.payments.find({"shop_id": shop_id}, {"_id": 0}).to_list(2000)
    rows = []
    for inv in invoices:
        rows.append({"date": inv["invoice_date"], "type": "invoice", "ref": inv["invoice_no"],
                     "particulars": f"Invoice {inv['invoice_no']}", "debit": inv["grand_total"], "credit": 0})
    for p in payments:
        rows.append({"date": p["payment_date"], "type": "payment", "ref": p.get("invoice_no", ""),
                     "particulars": f"Payment ({p['mode']})", "debit": 0, "credit": p["amount"]})
    rows.sort(key=lambda r: r["date"])
    balance = opening
    for r in rows:
        balance += r["debit"] - r["credit"]
        r["balance"] = round(balance, 2)
    total_debit = round(sum(r["debit"] for r in rows), 2)
    total_credit = round(sum(r["credit"] for r in rows), 2)
    return {
        "shop": {"shop_no": shop["shop_no"], "name": shop["name"], "location": shop.get("location", "")},
        "opening_balance": opening, "rows": rows,
        "total_debit": total_debit, "total_credit": total_credit,
        "closing_balance": round(opening + total_debit - total_credit, 2),
    }

# ---------------- Reports ----------------
@api_router.get("/reports/daily")
async def daily_report(day: str = "", user: dict = Depends(get_current_user)):
    if not day:
        day = datetime.now(timezone.utc).date().isoformat()
    lo, hi = day, day + "T23:59:59"
    entries = await db.entries.find({"entry_date": {"$gte": lo, "$lte": hi}}, {"_id": 0}).to_list(3000)
    invoices = await db.invoices.find({"invoice_date": {"$gte": lo, "$lte": hi}}, {"_id": 0}).to_list(3000)
    payments = await db.payments.find({"payment_date": {"$gte": lo, "$lte": hi}}, {"_id": 0}).to_list(3000)
    return {
        "day": day,
        "boxes": sum(e.get("quantity", 0) for e in entries),
        "waste_kg": round(sum(e.get("waste_kg", 0) for e in entries), 2),
        "entries_count": len(entries),
        "invoice_count": len(invoices),
        "invoice_total": round(sum(i.get("grand_total", 0) for i in invoices), 2),
        "collections": round(sum(p.get("amount", 0) for p in payments), 2),
        "entries": entries, "invoices": invoices, "payments": payments,
    }

@api_router.get("/reports/monthly")
async def monthly_report(month: str = "", user: dict = Depends(get_current_user)):
    if not month:
        month = datetime.now(timezone.utc).strftime("%Y-%m")
    lo, hi = month + "-01", month + "-31T23:59:59"
    entries = await db.entries.find({"entry_date": {"$gte": lo, "$lte": hi}}, {"_id": 0}).to_list(9000)
    invoices = await db.invoices.find({"invoice_date": {"$gte": lo, "$lte": hi}}, {"_id": 0}).to_list(9000)
    payments = await db.payments.find({"payment_date": {"$gte": lo, "$lte": hi}}, {"_id": 0}).to_list(9000)
    by_day = {}
    for e in entries:
        d = e["entry_date"][:10]
        by_day.setdefault(d, {"boxes": 0, "waste": 0.0, "invoiced": 0.0, "collected": 0.0})
        by_day[d]["boxes"] += e.get("quantity", 0)
        by_day[d]["waste"] += e.get("waste_kg", 0)
    for i in invoices:
        d = i["invoice_date"][:10]
        by_day.setdefault(d, {"boxes": 0, "waste": 0.0, "invoiced": 0.0, "collected": 0.0})
        by_day[d]["invoiced"] += i.get("grand_total", 0)
    for p in payments:
        d = p["payment_date"][:10]
        by_day.setdefault(d, {"boxes": 0, "waste": 0.0, "invoiced": 0.0, "collected": 0.0})
        by_day[d]["collected"] += p.get("amount", 0)
    daily = [{"date": k, **{kk: round(vv, 2) for kk, vv in v.items()}} for k, v in sorted(by_day.items())]
    return {
        "month": month,
        "total_boxes": sum(e.get("quantity", 0) for e in entries),
        "total_waste": round(sum(e.get("waste_kg", 0) for e in entries), 2),
        "total_invoiced": round(sum(i.get("grand_total", 0) for i in invoices), 2),
        "total_collected": round(sum(p.get("amount", 0) for p in payments), 2),
        "invoice_count": len(invoices),
        "outstanding": round(sum(i.get("balance", 0) for i in invoices), 2),
        "daily": daily,
    }

@api_router.get("/inventory")
async def inventory_dashboard(user: dict = Depends(get_current_user)):
    shops = await db.shops.find({}, {"_id": 0}).to_list(1000)
    entries = await db.entries.find({}, {"_id": 0}).to_list(9000)
    agg = {}
    for e in entries:
        sid = e["shop_id"]
        agg.setdefault(sid, {"boxes": 0, "waste": 0.0, "last": None, "count": 0})
        agg[sid]["boxes"] += e.get("quantity", 0)
        agg[sid]["waste"] += e.get("waste_kg", 0)
        agg[sid]["count"] += 1
        d = e["entry_date"]
        if not agg[sid]["last"] or d > agg[sid]["last"]:
            agg[sid]["last"] = d
    rows = []
    for s in shops:
        a = agg.get(s["id"], {"boxes": 0, "waste": 0.0, "last": None, "count": 0})
        rows.append({
            "shop_no": s["shop_no"], "name": s["name"], "location": s.get("location", ""),
            "cycle_days": s.get("cycle_days", 5),
            "total_boxes": a["boxes"], "total_waste": round(a["waste"], 2),
            "entries": a["count"], "last_entry": a["last"],
        })
    rows.sort(key=lambda r: r["total_boxes"], reverse=True)
    return {
        "total_boxes": sum(r["total_boxes"] for r in rows),
        "total_waste": round(sum(r["total_waste"] for r in rows), 2),
        "active_shops": len([r for r in rows if r["entries"] > 0]),
        "rows": rows,
    }

# ---------------- Bulk shop import ----------------
@api_router.post("/shops/import")
async def import_shops(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content = await file.read()
    updated, created, errors = 0, 0, []
    rows = []
    name = (file.filename or "").lower()
    try:
        if name.endswith(".csv"):
            text = content.decode("utf-8", errors="ignore")
            lines = [l for l in text.splitlines() if l.strip()]
            if lines:
                headers = [h.strip().lower() for h in lines[0].split(",")]
                for line in lines[1:]:
                    vals = line.split(",")
                    rows.append({headers[i]: vals[i].strip() if i < len(vals) else "" for i in range(len(headers))})
        else:
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True)
            ws = wb.active
            data = list(ws.iter_rows(values_only=True))
            if data:
                headers = [str(h).strip().lower() if h is not None else "" for h in data[0]]
                for r in data[1:]:
                    rows.append({headers[i]: (str(r[i]).strip() if i < len(r) and r[i] is not None else "") for i in range(len(headers))})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")

    def pick(row, *keys):
        for k in keys:
            if k in row and row[k]:
                return row[k]
        return ""

    for row in rows:
        shop_no = pick(row, "shop_no", "shop no", "shopno", "shop number")
        if not shop_no:
            continue
        supervisor = pick(row, "supervisor", "supervisor name", "incharge")
        contact = pick(row, "contact", "phone", "mobile", "contact no")
        existing = await db.shops.find_one({"shop_no": shop_no})
        update = {}
        if supervisor:
            update["supervisor"] = supervisor
        if contact:
            update["contact"] = contact
        if existing:
            if update:
                await db.shops.update_one({"shop_no": shop_no}, {"$set": update})
                updated += 1
        else:
            new_shop = Shop(shop_no=shop_no, name=pick(row, "name", "shop name") or f"TASMAC {shop_no}",
                            district=pick(row, "district"), location=pick(row, "location"),
                            supervisor=supervisor, contact=contact)
            await db.shops.insert_one(new_shop.model_dump())
            created += 1
    return {"updated": updated, "created": created, "processed": len(rows)}

# ---------------- Email (Resend managed) ----------------
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Auro Products")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)

def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)

def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)

class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []
    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []
    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)
    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []

def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")

async def send_email(*, to: str, subject: str, html: str) -> Optional[str]:
    if not EMAIL_KEY:
        logger.warning("EMERGENT_EMAIL_KEY not set; skipping email")
        return None
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                 headers={"X-Email-Key": EMAIL_KEY}, json=payload)
    resp.raise_for_status()
    return resp.json().get("id")

# ---------------- WhatsApp / SMS (Twilio, optional) ----------------
def send_whatsapp_sms(to_number: str, message: str) -> dict:
    sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
    token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    wa_from = os.environ.get("TWILIO_WHATSAPP_FROM", "")
    sms_from = os.environ.get("TWILIO_SMS_FROM", "")
    if not (sid and token and to_number):
        return {"sent": False, "reason": "twilio_not_configured"}
    try:
        from twilio.rest import Client
        client = Client(sid, token)
        result = {}
        if wa_from:
            m = client.messages.create(from_=f"whatsapp:{wa_from}", to=f"whatsapp:{to_number}", body=message)
            result["whatsapp_sid"] = m.sid
        if sms_from:
            m = client.messages.create(from_=sms_from, to=to_number, body=message)
            result["sms_sid"] = m.sid
        result["sent"] = bool(result)
        return result
    except Exception as e:
        logger.error(f"Twilio send failed: {e}")
        return {"sent": False, "reason": str(e)}

async def build_due_reminders() -> list:
    shops = await db.shops.find({"active": True}, {"_id": 0}).to_list(1000)
    entries = await db.entries.find({}, {"_id": 0}).to_list(9000)
    last_by_shop = {}
    for e in entries:
        sid = e["shop_id"]; d = parse_iso(e["entry_date"])
        if sid not in last_by_shop or d > last_by_shop[sid]:
            last_by_shop[sid] = d
    today = datetime.now(timezone.utc).date()
    due = []
    for s in shops:
        last = last_by_shop.get(s["id"])
        if not last:
            continue
        next_date = (last + timedelta(days=s.get("cycle_days", 5))).date()
        if next_date <= today:
            due.append({"shop_no": s["shop_no"], "name": s["name"], "location": s.get("location", ""),
                        "next": next_date.isoformat(), "overdue_days": (today - next_date).days})
    due.sort(key=lambda r: r["overdue_days"], reverse=True)
    return due

async def run_reminder_job():
    try:
        settings = await get_settings_doc()
        due = await build_due_reminders()
        if not due:
            logger.info("Reminder job: no shops due")
            return
        lines = "".join(
            f'<tr><td style="padding:6px 10px;border:1px solid #ddd">{escape(d["shop_no"])}</td>'
            f'<td style="padding:6px 10px;border:1px solid #ddd">{escape(d["name"])} — {escape(d["location"])}</td>'
            f'<td style="padding:6px 10px;border:1px solid #ddd">{escape(str(d["next"]))}</td>'
            f'<td style="padding:6px 10px;border:1px solid #ddd">{d["overdue_days"]}d</td></tr>'
            for d in due[:100]
        )
        html = (f'<table role="presentation" width="100%"><tr><td style="padding:20px;font-family:Arial,sans-serif">'
                f'<h2 style="margin:0 0 8px">Cotton Box Pickup Reminders</h2>'
                f'<p>{len(due)} shop(s) are due or overdue for a cotton box pickup today.</p>'
                f'<table style="border-collapse:collapse;font-size:13px"><tr>'
                f'<th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Shop</th>'
                f'<th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Location</th>'
                f'<th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Due Date</th>'
                f'<th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Overdue</th></tr>{lines}</table>'
                f'<p style="font-size:12px;color:#888;margin-top:16px">Sent by {escape(EMAIL_FROM_NAME)} · Built by R I Billing Pro. '
                f'We never ask for your password or card details by email.</p></td></tr></table>')
        email_to = settings.get("reminder_email") or os.environ.get("ADMIN_EMAIL")
        if email_to:
            try:
                await send_email(to=email_to, subject=f"{len(due)} cotton box pickups due today", html=html)
            except Exception as e:
                logger.error(f"Reminder email failed: {e}")
        wa = settings.get("reminder_whatsapp") or ""
        if wa:
            top = "\n".join(f"{d['shop_no']} {d['name']} (due {d['next']})" for d in due[:15])
            send_whatsapp_sms(wa, f"Auro Products: {len(due)} cotton box pickups due today.\n{top}")
    except Exception as e:
        logger.error(f"Reminder job error: {e}")

@api_router.post("/reminders/run")
async def trigger_reminders(background: BackgroundTasks, user: dict = Depends(get_current_user)):
    due = await build_due_reminders()
    background.add_task(lambda: None)
    await run_reminder_job()
    return {"triggered": True, "due_count": len(due)}

@api_router.post("/cron/reminders")
async def cron_reminders(request: Request, background: BackgroundTasks, authorization: str = Header(None)):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    token = (authorization or "").replace("Bearer ", "").strip()
    if not secret or not hmac.compare_digest(token, secret):
        raise HTTPException(status_code=401, detail="Unauthorized")
    background.add_task(run_reminder_job)
    return {"accepted": True}

# ---------------- Overdue nudge (re-ping shops still overdue >= 2 days) ----------------
async def run_overdue_nudge():
    try:
        settings = await get_settings_doc()
        due = await build_due_reminders()
        nudge = [d for d in due if d["overdue_days"] >= 2]
        if not nudge:
            logger.info("Overdue nudge: none overdue >= 2 days")
            return
        lines = "".join(
            f'<tr><td style="padding:6px 10px;border:1px solid #ddd">{escape(d["shop_no"])}</td>'
            f'<td style="padding:6px 10px;border:1px solid #ddd">{escape(d["name"])} — {escape(d["location"])}</td>'
            f'<td style="padding:6px 10px;border:1px solid #ddd;color:#c00"><b>{d["overdue_days"]} days overdue</b></td></tr>'
            for d in nudge[:100]
        )
        html = (f'<table role="presentation" width="100%"><tr><td style="padding:20px;font-family:Arial,sans-serif">'
                f'<h2 style="margin:0 0 8px;color:#c00">Still Overdue — Action Needed</h2>'
                f'<p>{len(nudge)} shop(s) have been overdue for 2 or more days for a cotton box pickup.</p>'
                f'<table style="border-collapse:collapse;font-size:13px"><tr>'
                f'<th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Shop</th>'
                f'<th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Location</th>'
                f'<th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Status</th></tr>{lines}</table>'
                f'<p style="font-size:12px;color:#888;margin-top:16px">Sent by {escape(EMAIL_FROM_NAME)} · Built by R I Billing Pro. '
                f'We never ask for your password or card details by email.</p></td></tr></table>')
        email_to = settings.get("reminder_email") or os.environ.get("ADMIN_EMAIL")
        if email_to:
            try:
                await send_email(to=email_to, subject=f"{len(nudge)} shops still overdue (2+ days)", html=html)
            except Exception as e:
                logger.error(f"Overdue nudge email failed: {e}")
        wa = settings.get("reminder_whatsapp") or ""
        if wa:
            top = "\n".join(f"{d['shop_no']} {d['name']} ({d['overdue_days']}d overdue)" for d in nudge[:15])
            send_whatsapp_sms(wa, f"Auro Products URGENT: {len(nudge)} shops overdue 2+ days.\n{top}")
    except Exception as e:
        logger.error(f"Overdue nudge error: {e}")

@api_router.post("/overdue-nudge/run")
async def trigger_overdue(user: dict = Depends(get_current_user)):
    due = await build_due_reminders()
    nudge = [d for d in due if d["overdue_days"] >= 2]
    await run_overdue_nudge()
    return {"triggered": True, "nudge_count": len(nudge)}

@api_router.post("/cron/overdue-nudge")
async def cron_overdue(request: Request, background: BackgroundTasks, authorization: str = Header(None)):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    token = (authorization or "").replace("Bearer ", "").strip()
    if not secret or not hmac.compare_digest(token, secret):
        raise HTTPException(status_code=401, detail="Unauthorized")
    background.add_task(run_overdue_nudge)
    return {"accepted": True}

# ---------------- Collections (outstanding balance per shop) ----------------
@api_router.get("/collections")
async def collections(user: dict = Depends(get_current_user)):
    shops = await db.shops.find({}, {"_id": 0}).to_list(1000)
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(9000)
    payments = await db.payments.find({}, {"_id": 0}).to_list(9000)
    inv_by, pay_by = {}, {}
    for i in invoices:
        inv_by[i["shop_id"]] = inv_by.get(i["shop_id"], 0) + i.get("grand_total", 0)
    for p in payments:
        pay_by[p["shop_id"]] = pay_by.get(p["shop_id"], 0) + p.get("amount", 0)
    rows = []
    for s in shops:
        opening = s.get("opening_balance", 0.0)
        invoiced = round(inv_by.get(s["id"], 0), 2)
        paid = round(pay_by.get(s["id"], 0), 2)
        outstanding = round(opening + invoiced - paid, 2)
        if abs(outstanding) < 0.01:
            continue
        rows.append({
            "shop_id": s["id"], "shop_no": s["shop_no"], "name": s["name"], "location": s.get("location", ""),
            "opening": opening, "invoiced": invoiced, "paid": paid, "outstanding": outstanding,
        })
    rows.sort(key=lambda r: r["outstanding"], reverse=True)
    return {
        "total_outstanding": round(sum(r["outstanding"] for r in rows), 2),
        "shops_with_dues": len(rows),
        "total_paid": round(sum(r["paid"] for r in rows), 2),
        "rows": rows,
    }

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
