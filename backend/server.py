import os
import datetime
import json
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy import create_engine, ForeignKey, text, func
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship, Mapped, mapped_column

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL") or "postgresql://neondb_owner:npg_T2MhSB8cwrNl@ep-falling-shadow-b395z9yn-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- DATABASE MODELS ---

class ShopModel(Base):
    __tablename__ = "shops"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    shop_no: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(nullable=False)
    district: Mapped[Optional[str]] = mapped_column(nullable=True)
    location: Mapped[Optional[str]] = mapped_column(nullable=True)
    supervisor: Mapped[Optional[str]] = mapped_column(nullable=True)
    contact: Mapped[Optional[str]] = mapped_column(nullable=True)
    cycle_days: Mapped[Optional[int]] = mapped_column(default=5)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(default=datetime.datetime.utcnow)


class EntryModel(Base):
    __tablename__ = "entries"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id"), nullable=False)
    box_type: Mapped[Optional[str]] = mapped_column(nullable=True)
    brandy_qty: Mapped[Optional[int]] = mapped_column(default=0)
    brandy_rate: Mapped[Optional[float]] = mapped_column(default=16.0)
    beer_qty: Mapped[Optional[int]] = mapped_column(default=0)
    beer_rate: Mapped[Optional[float]] = mapped_column(default=16.0)
    quantity: Mapped[int] = mapped_column(nullable=False, default=0)
    waste_kg: Mapped[float] = mapped_column(nullable=False, default=0.0)
    opening_balance_deducted: Mapped[Optional[float]] = mapped_column(default=0.0)
    taxable_amount: Mapped[Optional[float]] = mapped_column(default=0.0)
    cgst_amount: Mapped[Optional[float]] = mapped_column(default=0.0)
    sgst_amount: Mapped[Optional[float]] = mapped_column(default=0.0)
    total_amount: Mapped[Optional[float]] = mapped_column(default=0.0)
    entry_date: Mapped[datetime.datetime] = mapped_column(nullable=False, default=datetime.datetime.utcnow)
    notes: Mapped[Optional[str]] = mapped_column(nullable=True)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(default=datetime.datetime.utcnow)

    payments: Mapped[List["PaymentModel"]] = relationship(back_populates="entry", cascade="all, delete-orphan")


class CollectionModel(Base):
    __tablename__ = "collections"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id"), nullable=False)
    amount: Mapped[float] = mapped_column(nullable=False, default=0.0)
    collection_date: Mapped[datetime.datetime] = mapped_column(nullable=False, default=datetime.datetime.utcnow)
    payment_mode: Mapped[Optional[str]] = mapped_column(default="Cash")
    reference_no: Mapped[Optional[str]] = mapped_column(nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(nullable=True)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(default=datetime.datetime.utcnow)


class SettingModel(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(primary_key=True, index=True)
    value: Mapped[Optional[str]] = mapped_column(nullable=True)


class InvoiceModel(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    invoice_no: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id"), nullable=False)
    customer_name: Mapped[Optional[str]] = mapped_column(nullable=True)
    invoice_date: Mapped[datetime.datetime] = mapped_column(nullable=False, default=datetime.datetime.utcnow)
    invoice_type: Mapped[Optional[str]] = mapped_column(default="SALES")
    truck_no: Mapped[Optional[str]] = mapped_column(nullable=True)
    total_weight: Mapped[Optional[float]] = mapped_column(nullable=True)
    taxable_amount: Mapped[Optional[float]] = mapped_column(default=0.0)
    cgst_percent: Mapped[Optional[float]] = mapped_column(default=2.5)
    sgst_percent: Mapped[Optional[float]] = mapped_column(default=2.5)
    tax_amount: Mapped[Optional[float]] = mapped_column(default=0.0)
    total_amount: Mapped[Optional[float]] = mapped_column(default=0.0)
    amount_paid: Mapped[Optional[float]] = mapped_column(default=0.0)
    status: Mapped[Optional[str]] = mapped_column(default="unpaid")
    notes: Mapped[Optional[str]] = mapped_column(nullable=True)
    location: Mapped[Optional[str]] = mapped_column(nullable=True)
    supervisor: Mapped[Optional[str]] = mapped_column(nullable=True)
    contact: Mapped[Optional[str]] = mapped_column(nullable=True)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(default=datetime.datetime.utcnow)

    items: Mapped[List["InvoiceItemModel"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    payments: Mapped[List["PaymentModel"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItemModel(Base):
    __tablename__ = "invoice_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"), nullable=False)
    description: Mapped[str] = mapped_column(nullable=False)
    hsn: Mapped[Optional[str]] = mapped_column(default="4819")
    unit: Mapped[Optional[str]] = mapped_column(default="PCS")
    quantity: Mapped[int] = mapped_column(nullable=False, default=1)
    rate: Mapped[float] = mapped_column(nullable=False, default=16.0)
    amount: Mapped[float] = mapped_column(nullable=False, default=0.0)

    invoice: Mapped["InvoiceModel"] = relationship(back_populates="items")


class PaymentModel(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    shop_id: Mapped[Optional[int]] = mapped_column(ForeignKey("shops.id"), nullable=True)
    invoice_id: Mapped[Optional[int]] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    entry_id: Mapped[Optional[int]] = mapped_column(ForeignKey("entries.id"), nullable=True)
    invoice_type: Mapped[Optional[str]] = mapped_column(default="SALE_INVOICE")
    amount: Mapped[float] = mapped_column(nullable=False, default=0.0)
    mode: Mapped[Optional[str]] = mapped_column(default="UPI")
    payment_date: Mapped[datetime.datetime] = mapped_column(nullable=False, default=datetime.datetime.utcnow)
    notes: Mapped[Optional[str]] = mapped_column(nullable=True)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(default=datetime.datetime.utcnow)

    invoice: Mapped[Optional["InvoiceModel"]] = relationship(back_populates="payments")
    entry: Mapped[Optional["EntryModel"]] = relationship(back_populates="payments")


class ExpenseModel(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    category: Mapped[str] = mapped_column(nullable=False, default="Auto Rent")
    amount: Mapped[float] = mapped_column(nullable=False, default=0.0)
    expense_date: Mapped[datetime.datetime] = mapped_column(nullable=False, default=datetime.datetime.utcnow)
    notes: Mapped[Optional[str]] = mapped_column(nullable=True)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(default=datetime.datetime.utcnow)


Base.metadata.create_all(bind=engine)

def migrate_db():
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE entries ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0;"))
        conn.execute(text("ALTER TABLE entries ADD COLUMN IF NOT EXISTS waste_kg DOUBLE PRECISION DEFAULT 0.0;"))
        conn.execute(text("ALTER TABLE entries ADD COLUMN IF NOT EXISTS box_type VARCHAR;"))
        conn.execute(text("ALTER TABLE entries ADD COLUMN IF NOT EXISTS brandy_qty INTEGER DEFAULT 0;"))
        conn.execute(text("ALTER TABLE entries ADD COLUMN IF NOT EXISTS brandy_rate DOUBLE PRECISION DEFAULT 16.0;"))
        conn.execute(text("ALTER TABLE entries ADD COLUMN IF NOT EXISTS beer_qty INTEGER DEFAULT 0;"))
        conn.execute(text("ALTER TABLE entries ADD COLUMN IF NOT EXISTS beer_rate DOUBLE PRECISION DEFAULT 16.0;"))
        conn.execute(text("ALTER TABLE entries ADD COLUMN IF NOT EXISTS opening_balance_deducted DOUBLE PRECISION DEFAULT 0.0;"))
        conn.execute(text("ALTER TABLE entries ADD COLUMN IF NOT EXISTS taxable_amount DOUBLE PRECISION DEFAULT 0.0;"))
        conn.execute(text("ALTER TABLE entries ADD COLUMN IF NOT EXISTS cgst_amount DOUBLE PRECISION DEFAULT 0.0;"))
        conn.execute(text("ALTER TABLE entries ADD COLUMN IF NOT EXISTS sgst_amount DOUBLE PRECISION DEFAULT 0.0;"))
        conn.execute(text("ALTER TABLE entries ADD COLUMN IF NOT EXISTS total_amount DOUBLE PRECISION DEFAULT 0.0;"))
        conn.execute(text("ALTER TABLE entries ADD COLUMN IF NOT EXISTS notes VARCHAR;"))
        conn.execute(text("ALTER TABLE entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;"))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS expenses (
                id SERIAL PRIMARY KEY,
                category VARCHAR NOT NULL DEFAULT 'Auto Rent',
                amount DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                expense_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                notes VARCHAR,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))
        conn.commit()

migrate_db()

app = FastAPI(title="Auro Product API", version="1.4")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- PYDANTIC SCHEMAS ---

class ShopCreate(BaseModel):
    shop_no: str
    name: str
    district: Optional[str] = None
    location: Optional[str] = None
    supervisor: Optional[str] = None
    contact: Optional[str] = None
    cycle_days: Optional[int] = 5

class EntryCreate(BaseModel):
    shop_id: Optional[int] = None
    new_shop: Optional[ShopCreate] = None
    box_type: Optional[str] = None
    brandy_qty: Optional[int] = 0
    brandy_rate: Optional[float] = 16.0
    beer_qty: Optional[int] = 0
    beer_rate: Optional[float] = 16.0
    quantity: Optional[int] = 0
    waste_kg: float = 0.0
    apply_opening_balance: Optional[bool] = True
    opening_balance_deducted: Optional[float] = 0.0
    taxable_amount: Optional[float] = 0.0
    cgst_amount: Optional[float] = 0.0
    sgst_amount: Optional[float] = 0.0
    total_amount: Optional[float] = 0.0
    entry_date: Optional[str] = None
    notes: Optional[str] = None

class CollectionCreate(BaseModel):
    shop_id: int
    amount: float
    collection_date: Optional[str] = None
    payment_mode: Optional[str] = "Cash"
    reference_no: Optional[str] = None
    notes: Optional[str] = None

class ExpenseCreate(BaseModel):
    category: str
    amount: float
    expense_date: Optional[str] = None
    notes: Optional[str] = None

class OpeningBalanceRequest(BaseModel):
    opening_balance: float
    mode: Optional[str] = "add"
    entry_date: Optional[str] = None
    entered_by: Optional[str] = "Admin"
    timestamp: Optional[str] = None

class InvoiceItemCreate(BaseModel):
    description: str
    hsn: Optional[str] = "4819"
    unit: Optional[str] = "PCS"
    quantity: int
    rate: float

class InvoiceCreate(BaseModel):
    shop_id: Optional[int] = None
    customer_name: Optional[str] = None
    invoice_date: Optional[str] = None
    invoice_type: Optional[str] = "SALES"
    truck_no: Optional[str] = None
    total_weight: Optional[float] = None
    cgst_percent: Optional[float] = 2.5
    sgst_percent: Optional[float] = 2.5
    location: Optional[str] = None
    supervisor: Optional[str] = None
    contact: Optional[str] = None
    items: List[InvoiceItemCreate]
    notes: Optional[str] = None

class PaymentCreate(BaseModel):
    shop_id: Optional[int] = None
    invoice_id: Optional[int] = None
    entry_id: Optional[int] = None
    invoice_type: Optional[str] = "SALE_INVOICE"
    amount: float
    mode: Optional[str] = "UPI"
    payment_date: Optional[str] = None
    notes: Optional[str] = None

# --- HEALTH & USER ROUTES ---

@app.get("/")
@app.get("/health")
@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "Auro Product API"}

# --- ENTRIES & INVOICES (DIRECT ARRAY ENDPOINTS PREVENT FRONTEND SORT ERROR) ---

@app.get("/api/entries")
@app.get("/entries")
def get_entries(db: Session = Depends(get_db)):
    entries = db.query(EntryModel).order_by(EntryModel.entry_date.desc()).all()
    return [
        {
            "id": e.id,
            "shop_id": e.shop_id,
            "box_type": e.box_type,
            "brandy_qty": e.brandy_qty,
            "brandy_rate": e.brandy_rate,
            "beer_qty": e.beer_qty,
            "beer_rate": e.beer_rate,
            "quantity": e.quantity,
            "waste_kg": e.waste_kg,
            "taxable_amount": e.taxable_amount,
            "cgst_amount": e.cgst_amount,
            "sgst_amount": e.sgst_amount,
            "total_amount": e.total_amount,
            "entry_date": e.entry_date.isoformat() if e.entry_date else None,
            "notes": e.notes,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in entries
    ]

@app.get("/api/invoices")
@app.get("/invoices")
def get_invoices(db: Session = Depends(get_db)):
    invoices = db.query(InvoiceModel).order_by(InvoiceModel.invoice_date.desc()).all()
    return [
        {
            "id": i.id,
            "invoice_no": i.invoice_no,
            "shop_id": i.shop_id,
            "customer_name": i.customer_name,
            "invoice_date": i.invoice_date.isoformat() if i.invoice_date else None,
            "invoice_type": i.invoice_type,
            "total_amount": i.total_amount,
            "amount_paid": i.amount_paid,
            "status": i.status,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }
        for i in invoices
    ]

# --- EXPENSES ENDPOINTS ---

@app.get("/api/expenses")
@app.get("/expenses")
def get_expenses(start: Optional[str] = None, end: Optional[str] = None, category: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(ExpenseModel)
    if start:
        try:
            start_dt = datetime.datetime.fromisoformat(start)
            query = query.filter(ExpenseModel.expense_date >= start_dt)
        except Exception:
            pass
    if end:
        try:
            end_dt = datetime.datetime.fromisoformat(end) + datetime.timedelta(days=1)
            query = query.filter(ExpenseModel.expense_date < end_dt)
        except Exception:
            pass
    if category:
        query = query.filter(ExpenseModel.category == category)

    expenses = query.order_by(ExpenseModel.expense_date.desc()).all()
    
    total_revenue = sum(e.total_amount or 0.0 for e in db.query(EntryModel).all()) + sum(i.total_amount or 0.0 for i in db.query(InvoiceModel).all())
    total_expenses = sum(exp.amount or 0.0 for exp in db.query(ExpenseModel).all())
    net_profit = total_revenue - total_expenses

    exp_list = [
        {
            "id": e.id,
            "category": e.category,
            "amount": e.amount,
            "expense_date": e.expense_date.isoformat() if e.expense_date else None,
            "notes": e.notes,
            "created_at": e.created_at.isoformat() if e.created_at else None
        }
        for e in expenses
    ]

    return {
        "expenses": exp_list,
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "net_profit": net_profit
    }

@app.post("/api/expenses")
@app.post("/expenses")
def create_expense(exp: ExpenseCreate, db: Session = Depends(get_db)):
    parsed_date = datetime.datetime.utcnow()
    if exp.expense_date:
        try:
            parsed_date = datetime.datetime.fromisoformat(str(exp.expense_date).replace("Z", "+00:00"))
        except Exception:
            pass
    db_exp = ExpenseModel(
        category=exp.category,
        amount=exp.amount,
        expense_date=parsed_date,
        notes=exp.notes
    )
    db.add(db_exp)
    db.commit()
    db.refresh(db_exp)
    return {"success": True, "data": db_exp}

# --- REPORTS ENDPOINTS ---

@app.get("/api/reports/daily")
@app.get("/reports/daily")
def get_daily_reports(day: Optional[str] = None, db: Session = Depends(get_db)):
    target_date = datetime.date.today()
    if day:
        try:
            target_date = datetime.datetime.fromisoformat(day).date()
        except Exception:
            pass

    start_dt = datetime.datetime.combine(target_date, datetime.time.min)
    end_dt = datetime.datetime.combine(target_date, datetime.time.max)

    invoices = db.query(InvoiceModel).filter(InvoiceModel.invoice_date >= start_dt, InvoiceModel.invoice_date <= end_dt).all()
    entries = db.query(EntryModel).filter(EntryModel.entry_date >= start_dt, EntryModel.entry_date <= end_dt).all()

    sale_inv = sum(i.total_amount or 0.0 for i in invoices if i.invoice_type == "SALES")
    purchase_inv = sum(e.total_amount or 0.0 for e in entries)
    
    sale_gst = sum(i.tax_amount or 0.0 for i in invoices if i.invoice_type == "SALES")
    purchase_gst = sum((e.cgst_amount or 0.0) + (e.sgst_amount or 0.0) for e in entries)

    return {
        "purchase_invoice_total": purchase_inv,
        "sale_invoice_total": sale_inv,
        "gst_collected_sales": sale_gst,
        "gst_collected_purchase": purchase_gst
    }

@app.get("/api/reports/monthly")
@app.get("/reports/monthly")
def get_monthly_reports(month: Optional[str] = None, db: Session = Depends(get_db)):
    if month:
        try:
            y, m = map(int, month.split("-"))
            start_dt = datetime.datetime(y, m, 1)
            end_dt = datetime.datetime(y + 1, 1, 1) if m == 12 else datetime.datetime(y, m + 1, 1)
        except Exception:
            start_dt = datetime.datetime.utcnow().replace(day=1, hour=0, minute=0, second=0)
            end_dt = datetime.datetime.utcnow()
    else:
        start_dt = datetime.datetime.utcnow().replace(day=1, hour=0, minute=0, second=0)
        end_dt = datetime.datetime.utcnow()

    invoices = db.query(InvoiceModel).filter(InvoiceModel.invoice_date >= start_dt, InvoiceModel.invoice_date < end_dt).all()
    entries = db.query(EntryModel).filter(EntryModel.entry_date >= start_dt, EntryModel.entry_date < end_dt).all()

    sale_inv = sum(i.total_amount or 0.0 for i in invoices if i.invoice_type == "SALES")
    purchase_inv = sum(e.total_amount or 0.0 for e in entries)
    sale_gst = sum(i.tax_amount or 0.0 for i in invoices if i.invoice_type == "SALES")
    purchase_gst = sum((e.cgst_amount or 0.0) + (e.sgst_amount or 0.0) for e in entries)

    return {
        "purchase_invoice_total": purchase_inv,
        "sale_invoice_total": sale_inv,
        "gst_collected_sales": sale_gst,
        "gst_collected_purchase": purchase_gst
    }

# --- WASTE ANALYTICS ENDPOINTS ---

@app.get("/api/analytics/waste")
@app.get("/analytics/waste")
def get_waste_analytics(db: Session = Depends(get_db)):
    shops = db.query(ShopModel).all()
    by_shop = []
    for s in shops:
        entries = db.query(EntryModel).filter(EntryModel.shop_id == s.id).all()
        boxes = sum(e.quantity or 0 for e in entries)
        waste = sum(e.waste_kg or 0.0 for e in entries)
        if boxes > 0 or waste > 0:
            by_shop.append({
                "shop_id": s.id,
                "shop_no": s.shop_no,
                "shop_name": s.name,
                "boxes": boxes,
                "waste": waste
            })
    return {"by_shop": by_shop, "by_month": [], "by_type_month": []}

# --- COLLECTIONS SUMMARY ENDPOINT ---

@app.get("/api/collections")
@app.get("/collections")
def get_collections_summary(db: Session = Depends(get_db)):
    shops = db.query(ShopModel).all()
    rows = []
    total_rev = 0.0
    total_purch = 0.0
    total_paid = 0.0

    for s in shops:
        invoices = db.query(InvoiceModel).filter(InvoiceModel.shop_id == s.id).all()
        entries = db.query(EntryModel).filter(EntryModel.shop_id == s.id).all()
        collections = db.query(CollectionModel).filter(CollectionModel.shop_id == s.id).all()
        payments = db.query(PaymentModel).filter(PaymentModel.shop_id == s.id).all()

        inv_tot = sum(i.total_amount or 0.0 for i in invoices)
        purch_tot = sum(e.total_amount or 0.0 for e in entries)
        paid_tot = sum(c.amount or 0.0 for c in collections) + sum(p.amount or 0.0 for p in payments)

        total_rev += inv_tot
        total_purch += purch_tot
        total_paid += paid_tot

        rows.append({
            "shop_id": s.id,
            "shop_no": s.shop_no,
            "name": s.name,
            "location": s.location or "",
            "invoiced": inv_tot,
            "purchase_amount": purch_tot,
            "paid": paid_tot
        })

    ob_setting = db.query(SettingModel).filter(SettingModel.key == "opening_balance").first()
    opening_balance = float(ob_setting.value) if ob_setting and ob_setting.value else 0.0

    return {
        "rows": rows,
        "global_opening_balance": opening_balance,
        "total_revenue": total_rev,
        "total_purchases": total_purch,
        "net_profit": total_rev - total_purch,
        "total_collected": total_paid,
        "total_outstanding": max(0.0, opening_balance + total_rev - total_purch - total_paid)
    }

# --- SHOPS REST ENDPOINTS ---

@app.get("/api/shops")
@app.get("/shops")
def get_shops(search: Optional[str] = None, district: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(ShopModel)
    if search:
        query = query.filter((ShopModel.name.ilike(f"%{search}%")) | (ShopModel.shop_no.ilike(f"%{search}%")))
    if district:
        query = query.filter(ShopModel.district == district)
    
    shops = query.order_by(ShopModel.id.desc()).all()
    return [{"id": s.id, "shop_no": s.shop_no, "name": s.name, "district": s.district, "location": s.location, "supervisor": s.supervisor, "contact": s.contact, "cycle_days": s.cycle_days} for s in shops]

# --- DASHBOARD ENDPOINT ---

@app.get("/api/dashboard")
@app.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    shops = db.query(ShopModel).all()
    entries = db.query(EntryModel).all()
    invoices = db.query(InvoiceModel).all()
    expenses = db.query(ExpenseModel).all()

    total_shops = len(shops)
    total_boxes = sum(e.quantity or 0 for e in entries)
    total_waste_kg = sum(e.waste_kg or 0.0 for e in entries)
    total_invoiced = sum(i.total_amount or 0.0 for i in invoices)

    reminders = []
    for s in shops:
        last_entry = db.query(EntryModel).filter(EntryModel.shop_id == s.id).order_by(EntryModel.entry_date.desc()).first()
        cycle = s.cycle_days or 5
        if last_entry and last_entry.entry_date:
            next_p = last_entry.entry_date + datetime.timedelta(days=cycle)
            status = "upcoming"
            if next_p.date() < datetime.date.today():
                status = "overdue"
            elif next_p.date() == datetime.date.today():
                status = "due_today"
        else:
            next_p = datetime.datetime.utcnow()
            status = "no_entry"

        reminders.append({
            "shop_id": s.id,
            "shop_no": s.shop_no,
            "shop_name": s.name,
            "cycle_days": cycle,
            "next_pickup": next_p.isoformat(),
            "status": status,
            "whatsapp_link": f"https://wa.me/{s.contact or ''}?text=Reminder:%20Pickup%20scheduled%20for%20{s.name}"
        })

    return {
        "shops_count": total_shops,
        "total_boxes": total_boxes,
        "total_waste_kg": total_waste_kg,
        "total_invoiced": total_invoiced,
        "reminders": reminders
    }

# --- CATCH-ALL SAFEGUARD ROUTE ---

@app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"])
def catch_all(path_name: str):
    return {"message": f"Route '/{path_name}' not explicitly mapped.", "status": 200}

if __name__ == "__main__":
    import uvicorn
    module_name = os.path.basename(__file__).replace(".py", "")
    uvicorn.run(f"{module_name}:app", host="0.0.0.0", port=8000, reload=True)