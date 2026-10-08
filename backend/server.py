import os
import datetime
import json
import urllib.parse
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Depends, Query, WebSocket, WebSocketDisconnect
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
    shop_id: Mapped[Optional[int]] = mapped_column(ForeignKey("shops.id"), nullable=True)
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
    shop_id: Mapped[Optional[int]] = mapped_column(ForeignKey("shops.id"), nullable=True)
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
    shop_id: Mapped[Optional[int]] = mapped_column(ForeignKey("shops.id"), nullable=True)
    customer_name: Mapped[Optional[str]] = mapped_column(nullable=True)
    party_name: Mapped[Optional[str]] = mapped_column(nullable=True)
    behalf_wine_shop_name: Mapped[Optional[str]] = mapped_column(nullable=True)
    behalf_wine_shop_no: Mapped[Optional[str]] = mapped_column(nullable=True)
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

        # Invoice schema updates
        conn.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS party_name VARCHAR;"))
        conn.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS behalf_wine_shop_name VARCHAR;"))
        conn.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS behalf_wine_shop_no VARCHAR;"))
        conn.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS location VARCHAR;"))
        conn.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS supervisor VARCHAR;"))
        conn.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS contact VARCHAR;"))

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

app = FastAPI(title="Auro Product API", version="1.8")

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

class PaymentCreate(BaseModel):
    shop_id: Optional[int] = None
    invoice_id: Optional[int] = None
    entry_id: Optional[int] = None
    invoice_type: Optional[str] = "SALE_INVOICE"
    amount: float
    mode: Optional[str] = "UPI"
    payment_date: Optional[str] = None
    notes: Optional[str] = None

class OpeningBalanceUpdate(BaseModel):
    opening_balance: float
    mode: str = "add"
    timestamp: Optional[str] = None
    entry_date: Optional[str] = None
    entered_by: Optional[str] = "Admin"

class ShopCreate(BaseModel):
    shop_no: str
    name: str
    district: Optional[str] = None
    location: Optional[str] = None
    supervisor: Optional[str] = None
    contact: Optional[str] = None
    cycle_days: Optional[int] = 5

class ExpenseCreate(BaseModel):
    category: str = "Auto Rent"
    amount: float
    expense_date: Optional[str] = None
    notes: Optional[str] = None

class CollectionCreate(BaseModel):
    shop_id: Optional[int] = None
    amount: float
    collection_date: Optional[str] = None
    payment_mode: Optional[str] = "Cash"
    reference_no: Optional[str] = None
    notes: Optional[str] = None

class SettingUpdate(BaseModel):
    key: str
    value: Optional[str] = None

class EntryCreate(BaseModel):
    shop_id: int
    box_type: Optional[str] = None
    brandy_qty: Optional[int] = 0
    brandy_rate: Optional[float] = 16.0
    beer_qty: Optional[int] = 0
    beer_rate: Optional[float] = 16.0
    cotton_box_amount: Optional[float] = 0.0
    cgst_amount: Optional[float] = 0.0
    sgst_amount: Optional[float] = 0.0
    gst_amount: Optional[float] = 0.0
    total_amount: Optional[float] = 0.0
    quantity: Optional[int] = 0
    waste_kg: Optional[float] = 0.0
    opening_balance_deducted: Optional[float] = 0.0
    entry_date: Optional[str] = None
    notes: Optional[str] = None

class InvoiceItemCreate(BaseModel):
    description: str
    hsn: Optional[str] = "4819"
    unit: Optional[str] = "PCS"
    quantity: float
    rate: float
    amount: float

class InvoiceCreate(BaseModel):
    invoice_no: str
    shop_id: Optional[int] = None
    customer_name: Optional[str] = None
    party_name: Optional[str] = None
    behalf_wine_shop_name: Optional[str] = None
    behalf_wine_shop_no: Optional[str] = None
    location: Optional[str] = None
    supervisor: Optional[str] = None
    contact: Optional[str] = None
    invoice_date: Optional[str] = None
    invoice_type: Optional[str] = "SALES"
    truck_no: Optional[str] = None
    total_weight: Optional[float] = None
    taxable_amount: Optional[float] = 0.0
    cgst_percent: Optional[float] = 2.5
    sgst_percent: Optional[float] = 2.5
    tax_amount: Optional[float] = 0.0
    total_amount: Optional[float] = 0.0
    notes: Optional[str] = None
    items: List[InvoiceItemCreate] = []

# --- COMPANIES DIRECTORY ENDPOINT ---

@app.get("/api/companies")
@app.get("/companies")
def get_companies(db: Session = Depends(get_db)):
    invoices = db.query(InvoiceModel).order_by(InvoiceModel.invoice_date.desc()).all()
    companies_map = {}
    
    for inv in invoices:
        name = (inv.party_name or inv.customer_name or "").strip()
        if name and name not in companies_map:
            companies_map[name] = {
                "name": name,
                "shop_no": inv.behalf_wine_shop_no or "-",
                "location": inv.location or "-",
                "contact": inv.contact or "-",
                "supervisor": inv.supervisor or "-"
            }
            
    return list(companies_map.values())

# --- DASHBOARD ENDPOINT ---

@app.get("/api/dashboard")
@app.get("/dashboard")
def get_dashboard_summary(db: Session = Depends(get_db)):
    total_shops = db.query(func.count(ShopModel.id)).scalar() or 0

    box_waste_query = db.query(
        func.coalesce(func.sum(EntryModel.quantity), 0).label("total_boxes"),
        func.coalesce(func.sum(EntryModel.waste_kg), 0.0).label("total_waste")
    ).first()

    total_boxes = int(box_waste_query.total_boxes or 0)
    total_waste_kg = float(box_waste_query.total_waste or 0.0)

    total_invoiced = db.query(
        func.coalesce(func.sum(InvoiceModel.total_amount), 0.0)
    ).filter(InvoiceModel.invoice_type == "SALES").scalar() or 0.0

    shops = db.query(ShopModel).all()
    reminders = []
    today = datetime.datetime.utcnow().date()

    for shop in shops:
        latest_entry = db.query(EntryModel).filter(EntryModel.shop_id == shop.id).order_by(EntryModel.entry_date.desc()).first()
        cycle_days = shop.cycle_days or 5

        if not latest_entry:
            status = "no_entry"
            next_pickup_str = today.isoformat()
        else:
            last_date = latest_entry.entry_date.date() if isinstance(latest_entry.entry_date, datetime.datetime) else latest_entry.entry_date
            next_pickup = last_date + datetime.timedelta(days=cycle_days)
            next_pickup_str = next_pickup.isoformat()

            if next_pickup < today:
                status = "overdue"
            elif next_pickup == today:
                status = "due_today"
            else:
                status = "upcoming"

        whatsapp_text = f"Hello {shop.name}, this is a reminder for cotton box pickup scheduled for shop {shop.shop_no}."
        encoded_msg = urllib.parse.quote(whatsapp_text)
        whatsapp_link = f"https://wa.me/{shop.contact or ''}?text={encoded_msg}"

        reminders.append({
            "shop_id": shop.id,
            "shop_no": shop.shop_no,
            "shop_name": shop.name,
            "cycle_days": cycle_days,
            "status": status,
            "next_pickup": next_pickup_str,
            "whatsapp_link": whatsapp_link
        })

    return {
        "shops_count": total_shops,
        "total_boxes": total_boxes,
        "total_waste_kg": total_waste_kg,
        "total_invoiced": float(total_invoiced),
        "reminders": reminders
    }


# --- SHOPS ENDPOINTS ---

@app.get("/api/shops/districts")
@app.get("/shops/districts")
def get_shop_districts(db: Session = Depends(get_db)):
    districts = db.query(ShopModel.district).filter(ShopModel.district.isnot(None)).distinct().all()
    return [d[0] for d in districts if d[0]]

@app.get("/api/shops")
@app.get("/shops")
def get_shops(search: Optional[str] = None, district: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(ShopModel)
    if search:
        query = query.filter((ShopModel.name.ilike(f"%{search}%")) | (ShopModel.shop_no.ilike(f"%{search}%")))
    if district:
        query = query.filter(ShopModel.district == district)
    shops = query.order_by(ShopModel.name.asc()).all()
    return [
        {
            "id": s.id,
            "shop_no": s.shop_no,
            "name": s.name,
            "district": s.district,
            "location": s.location,
            "supervisor": s.supervisor,
            "contact": s.contact,
            "cycle_days": s.cycle_days,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in shops
    ]

@app.get("/api/shops/{shop_id}")
@app.get("/shops/{shop_id}")
def get_shop_by_id(shop_id: int, db: Session = Depends(get_db)):
    shop = db.query(ShopModel).filter(ShopModel.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return {
        "id": shop.id,
        "shop_no": shop.shop_no,
        "name": shop.name,
        "district": shop.district,
        "location": shop.location,
        "supervisor": shop.supervisor,
        "contact": shop.contact,
        "cycle_days": shop.cycle_days,
        "created_at": shop.created_at.isoformat() if shop.created_at else None,
    }

@app.post("/api/shops")
@app.post("/shops")
def create_shop(shop: ShopCreate, db: Session = Depends(get_db)):
    existing = db.query(ShopModel).filter(ShopModel.shop_no == shop.shop_no).first()
    if existing:
        raise HTTPException(status_code=400, detail="Shop number already exists")
    
    db_shop = ShopModel(
        shop_no=shop.shop_no,
        name=shop.name,
        district=shop.district,
        location=shop.location,
        supervisor=shop.supervisor,
        contact=shop.contact,
        cycle_days=shop.cycle_days or 5
    )
    db.add(db_shop)
    db.commit()
    db.refresh(db_shop)
    return {"success": True, "data": {"id": db_shop.id, "shop_no": db_shop.shop_no, "name": db_shop.name}}

@app.put("/api/shops/{shop_id}")
@app.put("/shops/{shop_id}")
def update_shop(shop_id: int, shop: ShopCreate, db: Session = Depends(get_db)):
    db_shop = db.query(ShopModel).filter(ShopModel.id == shop_id).first()
    if not db_shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    db_shop.shop_no = shop.shop_no
    db_shop.name = shop.name
    db_shop.district = shop.district
    db_shop.location = shop.location
    db_shop.supervisor = shop.supervisor
    db_shop.contact = shop.contact
    db_shop.cycle_days = shop.cycle_days or 5

    db.commit()
    return {"success": True, "data": {"id": db_shop.id, "shop_no": db_shop.shop_no, "name": db_shop.name}}

@app.delete("/api/shops/{shop_id}")
@app.delete("/shops/{shop_id}")
def delete_shop(shop_id: int, db: Session = Depends(get_db)):
    shop = db.query(ShopModel).filter(ShopModel.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    try:
        db.query(PaymentModel).filter(PaymentModel.shop_id == shop_id).update({"shop_id": None})
        db.query(EntryModel).filter(EntryModel.shop_id == shop_id).update({"shop_id": None})
        db.query(CollectionModel).filter(CollectionModel.shop_id == shop_id).update({"shop_id": None})
        db.query(InvoiceModel).filter(InvoiceModel.shop_id == shop_id).update({"shop_id": None})

        db.delete(shop)
        db.commit()
        return {"success": True, "message": "Shop deleted successfully", "id": shop_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete shop: {str(e)}")

# --- EXPENSES ENDPOINTS ---

@app.get("/api/expenses")
@app.get("/expenses")
def get_expenses(db: Session = Depends(get_db)):
    expenses = db.query(ExpenseModel).order_by(ExpenseModel.expense_date.desc()).all()
    return [
        {
            "id": e.id,
            "category": e.category,
            "amount": e.amount,
            "expense_date": e.expense_date.isoformat() if e.expense_date else None,
            "notes": e.notes,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in expenses
    ]

@app.get("/api/expenses/{expense_id}")
@app.get("/expenses/{expense_id}")
def get_expense_by_id(expense_id: int, db: Session = Depends(get_db)):
    e = db.query(ExpenseModel).filter(ExpenseModel.id == expense_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {
        "id": e.id,
        "category": e.category,
        "amount": e.amount,
        "expense_date": e.expense_date.isoformat() if e.expense_date else None,
        "notes": e.notes,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }

@app.post("/api/expenses")
@app.post("/expenses")
def create_expense(expense: ExpenseCreate, db: Session = Depends(get_db)):
    parsed_date = datetime.datetime.utcnow()
    if expense.expense_date:
        try:
            parsed_date = datetime.datetime.fromisoformat(str(expense.expense_date).replace("Z", "+00:00"))
        except Exception:
            pass
            
    db_expense = ExpenseModel(
        category=expense.category,
        amount=float(expense.amount),
        expense_date=parsed_date,
        notes=expense.notes,
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return {"success": True, "data": {"id": db_expense.id, "amount": db_expense.amount}}

@app.delete("/api/expenses/{expense_id}")
@app.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    e = db.query(ExpenseModel).filter(ExpenseModel.id == expense_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(e)
    db.commit()
    return {"success": True}

# --- COLLECTIONS ENDPOINTS ---
@app.get("/api/collections")
@app.get("/collections")
def get_collections(db: Session = Depends(get_db)):
    shops = db.query(ShopModel).order_by(ShopModel.shop_no.asc()).all()
    
    setting = db.query(SettingModel).filter(SettingModel.key == "opening_balance").first()
    opening_balance = float(setting.value) if setting and setting.value else 0.0

    rows = []
    
    # 1. Shop-level calculations
    for shop in shops:
        inv_sum = db.query(func.sum(InvoiceModel.total_amount))\
                    .filter(InvoiceModel.shop_id == shop.id, InvoiceModel.invoice_type == "SALES").scalar() or 0.0
        
        purchase_sum = db.query(func.sum(EntryModel.total_amount))\
                        .filter(EntryModel.shop_id == shop.id).scalar() or 0.0

        paid_sum = db.query(func.sum(PaymentModel.amount))\
                     .filter(PaymentModel.shop_id == shop.id).scalar() or 0.0
        
        coll_sum = db.query(func.sum(CollectionModel.amount))\
                     .filter(CollectionModel.shop_id == shop.id).scalar() or 0.0
        
        total_paid = float(paid_sum + coll_sum)

        rows.append({
            "shop_id": shop.id,
            "shop_no": shop.shop_no,
            "name": shop.name,
            "location": shop.location or "-",
            "purchase_amount": float(purchase_sum),
            "invoiced": float(inv_sum),
            "paid": total_paid,
        })

    # 2. Global Totals
    # Total Revenue (Sales)
    total_revenue = db.query(func.coalesce(func.sum(InvoiceModel.total_amount), 0.0))\
                      .filter(InvoiceModel.invoice_type == "SALES").scalar() or 0.0

    # Total Purchases (Cotton Box)
    total_purchases = db.query(func.coalesce(func.sum(EntryModel.total_amount), 0.0)).scalar() or 0.0

    # Total Expenses & Labour Costs
    total_expenses = db.query(func.coalesce(func.sum(ExpenseModel.amount), 0.0)).scalar() or 0.0

    # Total Collections/Payments
    global_paid = db.query(func.coalesce(func.sum(PaymentModel.amount), 0.0)).scalar() or 0.0
    global_coll = db.query(func.coalesce(func.sum(CollectionModel.amount), 0.0)).scalar() or 0.0
    global_inv_paid = db.query(func.coalesce(func.sum(InvoiceModel.amount_paid), 0.0))\
                        .filter(InvoiceModel.invoice_type == "SALES").scalar() or 0.0

    total_collected = float(global_paid + global_coll + global_inv_paid)

    # 3. Calculation Formulas
    # Net Profit = Total Revenue - (Cotton Box Purchases + Expenses)
    net_profit = float(total_revenue) - (float(total_purchases) + float(total_expenses))

    # Closing Balance = Opening Balance - Purchases - Expenses + Revenue - Collected
    deduction_amount = float(total_purchases) + float(total_expenses)
    closing_balance = (opening_balance - deduction_amount) + float(total_revenue) - total_collected

    return {
        "global_opening_balance": opening_balance,
        "deduction_amount": deduction_amount,       # Purchases + Expenses
        "total_revenue": float(total_revenue),
        "total_purchases": float(total_purchases),
        "total_expenses": float(total_expenses),     # Expenses deducted
        "net_profit": net_profit,                    # Corrected Net Profit
        "total_collected": total_collected,
        "closing_balance": closing_balance,
        "total_outstanding": closing_balance,
        "rows": rows
    }

# --- ANALYTICS ENDPOINTS ---

@app.get("/api/analytics/waste")
def get_waste_analytics(db: Session = Depends(get_db)):
    results = db.query(
        ShopModel.id.label("shop_id"),
        ShopModel.shop_no.label("shop_no"),
        ShopModel.name.label("shop_name"),
        func.coalesce(func.sum(EntryModel.quantity), 0).label("boxes"),
        func.coalesce(func.sum(EntryModel.waste_kg), 0.0).label("waste")
    ).outerjoin(EntryModel, EntryModel.shop_id == ShopModel.id)\
     .group_by(ShopModel.id, ShopModel.shop_no, ShopModel.name)\
     .all()

    by_shop = [
        {
            "shop_id": r.shop_id,
            "shop_no": r.shop_no,
            "shop_name": r.shop_name,
            "boxes": int(r.boxes),
            "waste": float(r.waste)
        }
        for r in results
    ]

    return {
        "by_shop": by_shop,
        "by_month": [],
        "by_type_month": []
    }

# --- SETTINGS ENDPOINTS ---

@app.get("/api/settings")
@app.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(SettingModel).all()
    return {s.key: s.value for s in settings}

@app.post("/api/settings")
@app.post("/settings")
def update_setting(setting: SettingUpdate, db: Session = Depends(get_db)):
    item = db.query(SettingModel).filter(SettingModel.key == setting.key).first()
    if not item:
        item = SettingModel(key=setting.key, value=setting.value)
        db.add(item)
    else:
        item.value = setting.value
    db.commit()
    return {"success": True, "key": setting.key, "value": setting.value}

@app.get("/api/opening-balance")
@app.get("/opening-balance")
@app.get("/api/settings/opening-balance")
@app.get("/settings/opening-balance")
def get_opening_balance(db: Session = Depends(get_db)):
    setting = db.query(SettingModel).filter(SettingModel.key == "opening_balance").first()
    balance = float(setting.value) if setting and setting.value else 0.0
    
    history_setting = db.query(SettingModel).filter(SettingModel.key == "opening_balance_history").first()
    history = json.loads(history_setting.value) if (history_setting and history_setting.value) else []

    return {
        "opening_balance": balance,
        "value": str(balance),
        "history": history
    }

@app.post("/api/settings/opening-balance")
@app.post("/settings/opening-balance")
def update_opening_balance(payload: OpeningBalanceUpdate, db: Session = Depends(get_db)):
    setting = db.query(SettingModel).filter(SettingModel.key == "opening_balance").first()
    current_val = float(setting.value) if (setting and setting.value) else 0.0

    if payload.mode == "add":
        new_total = current_val + payload.opening_balance
    else:
        new_total = payload.opening_balance

    if not setting:
        setting = SettingModel(key="opening_balance", value=str(new_total))
        db.add(setting)
    else:
        setting.value = str(new_total)

    history_setting = db.query(SettingModel).filter(SettingModel.key == "opening_balance_history").first()
    history = json.loads(history_setting.value) if (history_setting and history_setting.value) else []

    log_entry = {
        "amount": payload.opening_balance,
        "total_after": new_total,
        "mode": payload.mode,
        "entry_date": payload.entry_date or datetime.datetime.utcnow().strftime("%Y-%m-%d"),
        "timestamp": payload.timestamp or datetime.datetime.utcnow().isoformat(),
        "entered_by": payload.entered_by or "Admin",
    }
    history.insert(0, log_entry)

    if not history_setting:
        history_setting = SettingModel(key="opening_balance_history", value=json.dumps(history))
        db.add(history_setting)
    else:
        history_setting.value = json.dumps(history)

    db.commit()

    return {
        "success": True,
        "opening_balance": new_total,
        "history": history
    }

# --- PAYMENTS ENDPOINTS ---

@app.get("/api/payments")
@app.get("/payments")
def get_payments(db: Session = Depends(get_db)):
    payments = db.query(PaymentModel).order_by(PaymentModel.payment_date.desc()).all()
    return [
        {
            "id": p.id,
            "shop_id": p.shop_id,
            "invoice_id": p.invoice_id,
            "entry_id": p.entry_id,
            "invoice_type": p.invoice_type,
            "amount": p.amount,
            "mode": p.mode,
            "payment_date": p.payment_date.isoformat() if p.payment_date else None,
            "notes": p.notes,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in payments
    ]

@app.post("/api/payments")
@app.post("/payments")
def create_payment(payment: PaymentCreate, db: Session = Depends(get_db)):
    try:
        parsed_date = datetime.datetime.utcnow()
        if payment.payment_date:
            try:
                parsed_date = datetime.datetime.fromisoformat(str(payment.payment_date).replace("Z", "+00:00"))
            except Exception:
                pass

        valid_shop_id = payment.shop_id
        if valid_shop_id:
            s_exists = db.query(ShopModel).filter(ShopModel.id == valid_shop_id).first()
            if not s_exists:
                valid_shop_id = None

        valid_invoice_id = payment.invoice_id
        if valid_invoice_id:
            i_exists = db.query(InvoiceModel).filter(InvoiceModel.id == valid_invoice_id).first()
            if not i_exists:
                valid_invoice_id = None

        valid_entry_id = payment.entry_id
        if valid_entry_id:
            e_exists = db.query(EntryModel).filter(EntryModel.id == valid_entry_id).first()
            if not e_exists:
                valid_entry_id = None

        db_payment = PaymentModel(
            shop_id=valid_shop_id,
            invoice_id=valid_invoice_id,
            entry_id=valid_entry_id,
            invoice_type=payment.invoice_type or "SALE_INVOICE",
            amount=float(payment.amount),
            mode=payment.mode or "UPI",
            payment_date=parsed_date,
            notes=payment.notes,
        )
        db.add(db_payment)

        if valid_invoice_id:
            inv = db.query(InvoiceModel).filter(InvoiceModel.id == valid_invoice_id).first()
            if inv:
                inv.amount_paid = (inv.amount_paid or 0.0) + payment.amount
                if inv.amount_paid >= (inv.total_amount or 0.0):
                    inv.status = "paid"
                elif inv.amount_paid > 0:
                    inv.status = "partial"

        db.commit()
        db.refresh(db_payment)
        return {
            "success": True,
            "data": {
                "id": db_payment.id,
                "shop_id": db_payment.shop_id,
                "invoice_id": db_payment.invoice_id,
                "entry_id": db_payment.entry_id,
                "invoice_type": db_payment.invoice_type,
                "amount": db_payment.amount,
                "mode": db_payment.mode,
                "payment_date": db_payment.payment_date.isoformat() if db_payment.payment_date else None,
                "notes": db_payment.notes,
                "created_at": db_payment.created_at.isoformat() if db_payment.created_at else None,
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to record payment: {str(e)}")

# --- REPORTS ENDPOINTS ---

@app.get("/api/reports/daily")
@app.get("/reports/daily")
def get_daily_report(day: Optional[str] = None, db: Session = Depends(get_db)):
    if day:
        try:
            target_date = datetime.datetime.strptime(day, "%Y-%m-%d").date()
        except ValueError:
            target_date = datetime.datetime.utcnow().date()
    else:
        target_date = datetime.datetime.utcnow().date()

    sales_query = db.query(
        func.coalesce(func.sum(InvoiceModel.total_amount), 0.0).label("total"),
        func.coalesce(func.sum(InvoiceModel.tax_amount), 0.0).label("gst")
    ).filter(
        InvoiceModel.invoice_type == "SALES",
        func.date(InvoiceModel.invoice_date) == target_date
    ).first()

    purchase_inv_query = db.query(
        func.coalesce(func.sum(InvoiceModel.total_amount), 0.0).label("total"),
        func.coalesce(func.sum(InvoiceModel.tax_amount), 0.0).label("gst")
    ).filter(
        InvoiceModel.invoice_type == "PURCHASE",
        func.date(InvoiceModel.invoice_date) == target_date
    ).first()

    entry_query = db.query(
        func.coalesce(func.sum(EntryModel.total_amount), 0.0).label("total"),
        func.coalesce(func.sum(EntryModel.cgst_amount + EntryModel.sgst_amount), 0.0).label("gst")
    ).filter(
        func.date(EntryModel.entry_date) == target_date
    ).first()

    total_purchase = float(purchase_inv_query.total) + float(entry_query.total)
    total_purchase_gst = float(purchase_inv_query.gst) + float(entry_query.gst)

    return {
        "sale_invoice_total": float(sales_query.total),
        "gst_collected_sales": float(sales_query.gst),
        "purchase_invoice_total": total_purchase,
        "gst_collected_purchase": total_purchase_gst
    }


@app.get("/api/reports/monthly")
@app.get("/reports/monthly")
def get_monthly_report(month: Optional[str] = None, db: Session = Depends(get_db)):
    if month and "-" in month:
        try:
            year, month_num = month.split("-")
        except ValueError:
            today = datetime.datetime.utcnow()
            year, month_num = today.year, today.month
    else:
        today = datetime.datetime.utcnow()
        year, month_num = today.year, today.month

    sales_query = db.query(
        func.coalesce(func.sum(InvoiceModel.total_amount), 0.0).label("total"),
        func.coalesce(func.sum(InvoiceModel.tax_amount), 0.0).label("gst")
    ).filter(
        InvoiceModel.invoice_type == "SALES",
        func.extract("year", InvoiceModel.invoice_date) == int(year),
        func.extract("month", InvoiceModel.invoice_date) == int(month_num)
    ).first()

    purchase_inv_query = db.query(
        func.coalesce(func.sum(InvoiceModel.total_amount), 0.0).label("total"),
        func.coalesce(func.sum(InvoiceModel.tax_amount), 0.0).label("gst")
    ).filter(
        InvoiceModel.invoice_type == "PURCHASE",
        func.extract("year", InvoiceModel.invoice_date) == int(year),
        func.extract("month", InvoiceModel.invoice_date) == int(month_num)
    ).first()

    entry_query = db.query(
        func.coalesce(func.sum(EntryModel.total_amount), 0.0).label("total"),
        func.coalesce(func.sum(EntryModel.cgst_amount + EntryModel.sgst_amount), 0.0).label("gst")
    ).filter(
        func.extract("year", EntryModel.entry_date) == int(year),
        func.extract("month", EntryModel.entry_date) == int(month_num)
    ).first()

    total_purchase = float(purchase_inv_query.total) + float(entry_query.total)
    total_purchase_gst = float(purchase_inv_query.gst) + float(entry_query.gst)

    return {
        "sale_invoice_total": float(sales_query.total),
        "gst_collected_sales": float(sales_query.gst),
        "purchase_invoice_total": total_purchase,
        "gst_collected_purchase": total_purchase_gst
    }

# --- ENTRIES & INVOICES ENDPOINTS ---

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
            "opening_balance_deducted": e.opening_balance_deducted,
            "entry_date": e.entry_date.isoformat() if e.entry_date else None,
            "notes": e.notes,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in entries
    ]

@app.get("/api/entries/{entry_id}")
@app.get("/entries/{entry_id}")
def get_entry_by_id(entry_id: int, db: Session = Depends(get_db)):
    e = db.query(EntryModel).filter(EntryModel.id == entry_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {
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
        "opening_balance_deducted": e.opening_balance_deducted,
        "entry_date": e.entry_date.isoformat() if e.entry_date else None,
        "notes": e.notes,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }

@app.post("/api/entries")
@app.post("/entries")
def create_entry(entry: EntryCreate, db: Session = Depends(get_db)):
    parsed_date = datetime.datetime.utcnow()
    if entry.entry_date:
        try:
            parsed_date = datetime.datetime.fromisoformat(str(entry.entry_date).replace("Z", "+00:00"))
        except Exception:
            pass

    computed_qty = entry.quantity if (entry.quantity is not None and entry.quantity > 0) else ((entry.brandy_qty or 0) + (entry.beer_qty or 0))
    computed_taxable = entry.cotton_box_amount if (entry.cotton_box_amount is not None and entry.cotton_box_amount > 0) else 0.0

    db_entry = EntryModel(
        shop_id=entry.shop_id,
        box_type=entry.box_type,
        brandy_qty=entry.brandy_qty or 0,
        brandy_rate=entry.brandy_rate or 16.0,
        beer_qty=entry.beer_qty or 0,
        beer_rate=entry.beer_rate or 16.0,
        quantity=computed_qty,
        waste_kg=entry.waste_kg or 0.0,
        taxable_amount=computed_taxable,
        cgst_amount=entry.cgst_amount or 0.0,
        sgst_amount=entry.sgst_amount or 0.0,
        total_amount=entry.total_amount or 0.0,
        opening_balance_deducted=entry.opening_balance_deducted or 0.0,
        entry_date=parsed_date,
        notes=entry.notes,
    )
    db.add(db_entry)

    deduction = entry.opening_balance_deducted or entry.total_amount or 0.0
    if deduction > 0:
        setting = db.query(SettingModel).filter(SettingModel.key == "opening_balance").first()
        if setting and setting.value:
            cur_bal = float(setting.value)
            setting.value = str(max(0.0, cur_bal - deduction))

    db.commit()
    db.refresh(db_entry)
    return {"success": True, "data": {"id": db_entry.id}}

@app.put("/api/entries/{entry_id}")
@app.put("/entries/{entry_id}")
def update_entry(entry_id: int, entry: EntryCreate, db: Session = Depends(get_db)):
    db_entry = db.query(EntryModel).filter(EntryModel.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if entry.entry_date:
        try:
            db_entry.entry_date = datetime.datetime.fromisoformat(str(entry.entry_date).replace("Z", "+00:00"))
        except Exception:
            pass

    computed_qty = entry.quantity if (entry.quantity is not None and entry.quantity > 0) else ((entry.brandy_qty or 0) + (entry.beer_qty or 0))

    old_deduction = db_entry.opening_balance_deducted or db_entry.total_amount or 0.0
    new_deduction = entry.opening_balance_deducted or entry.total_amount or 0.0
    diff = new_deduction - old_deduction

    db_entry.shop_id = entry.shop_id
    db_entry.box_type = entry.box_type
    db_entry.brandy_qty = entry.brandy_qty or 0
    db_entry.brandy_rate = entry.brandy_rate or 16.0
    db_entry.beer_qty = entry.beer_qty or 0
    db_entry.beer_rate = entry.beer_rate or 16.0
    db_entry.quantity = computed_qty
    db_entry.waste_kg = entry.waste_kg or 0.0
    db_entry.taxable_amount = entry.cotton_box_amount or 0.0
    db_entry.cgst_amount = entry.cgst_amount or 0.0
    db_entry.sgst_amount = entry.sgst_amount or 0.0
    db_entry.total_amount = entry.total_amount or 0.0
    db_entry.opening_balance_deducted = entry.opening_balance_deducted or 0.0
    db_entry.notes = entry.notes

    if diff != 0:
        setting = db.query(SettingModel).filter(SettingModel.key == "opening_balance").first()
        if setting and setting.value:
            cur_bal = float(setting.value)
            setting.value = str(max(0.0, cur_bal - diff))

    db.commit()
    return {"success": True, "data": {"id": db_entry.id}}

@app.delete("/api/entries/{entry_id}")
@app.delete("/entries/{entry_id}")
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    db_entry = db.query(EntryModel).filter(EntryModel.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    db.delete(db_entry)
    db.commit()
    return {"success": True}

@app.get("/api/invoices")
@app.get("/invoices")
def get_invoices(search: Optional[str] = None, start: Optional[str] = None, end: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(InvoiceModel)
    if search:
        query = query.filter(
            (InvoiceModel.invoice_no.ilike(f"%{search}%")) | 
            (InvoiceModel.customer_name.ilike(f"%{search}%")) |
            (InvoiceModel.party_name.ilike(f"%{search}%"))
        )
    
    invoices = query.order_by(InvoiceModel.invoice_date.desc()).all()
    return [
        {
            "id": i.id,
            "invoice_no": i.invoice_no,
            "shop_id": i.shop_id,
            "customer_name": i.customer_name,
            "party_name": i.party_name or i.customer_name,
            "behalf_wine_shop_name": i.behalf_wine_shop_name,
            "behalf_wine_shop_no": i.behalf_wine_shop_no,
            "location": i.location,
            "supervisor": i.supervisor,
            "contact": i.contact,
            "invoice_date": i.invoice_date.isoformat() if i.invoice_date else None,
            "invoice_type": i.invoice_type,
            "total_amount": i.total_amount,
            "amount_paid": i.amount_paid,
            "status": i.status,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }
        for i in invoices
    ]

@app.get("/api/invoices/{invoice_id}")
@app.get("/invoices/{invoice_id}")
def get_invoice_by_id(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {
        "id": invoice.id,
        "invoice_no": invoice.invoice_no,
        "shop_id": invoice.shop_id,
        "customer_name": invoice.customer_name,
        "party_name": invoice.party_name or invoice.customer_name,
        "behalf_wine_shop_name": invoice.behalf_wine_shop_name,
        "behalf_wine_shop_no": invoice.behalf_wine_shop_no,
        "location": invoice.location,
        "supervisor": invoice.supervisor,
        "contact": invoice.contact,
        "invoice_date": invoice.invoice_date.isoformat() if invoice.invoice_date else None,
        "invoice_type": invoice.invoice_type,
        "total_amount": invoice.total_amount,
        "amount_paid": invoice.amount_paid,
        "status": invoice.status,
        "notes": invoice.notes,
        "truck_no": invoice.truck_no,
        "total_weight": invoice.total_weight,
        "taxable_amount": invoice.taxable_amount,
        "tax_amount": invoice.tax_amount,
        "created_at": invoice.created_at.isoformat() if invoice.created_at else None,
        "items": [
            {
                "id": item.id,
                "description": item.description,
                "hsn": item.hsn,
                "unit": item.unit,
                "quantity": item.quantity,
                "rate": item.rate,
                "amount": item.amount,
            }
            for item in invoice.items
        ]
    }

@app.post("/api/invoices")
@app.post("/invoices")
def create_invoice(payload: InvoiceCreate, db: Session = Depends(get_db)):
    existing = db.query(InvoiceModel).filter(InvoiceModel.invoice_no == payload.invoice_no).first()
    if existing:
        raise HTTPException(status_code=400, detail="Invoice number already exists")

    parsed_date = datetime.datetime.utcnow()
    if payload.invoice_date:
        try:
            parsed_date = datetime.datetime.fromisoformat(str(payload.invoice_date).replace("Z", "+00:00"))
        except Exception:
            pass

    new_invoice = InvoiceModel(
        invoice_no=payload.invoice_no,
        shop_id=payload.shop_id,
        customer_name=payload.customer_name or payload.party_name,
        party_name=payload.party_name or payload.customer_name,
        behalf_wine_shop_name=payload.behalf_wine_shop_name,
        behalf_wine_shop_no=payload.behalf_wine_shop_no,
        location=payload.location,
        supervisor=payload.supervisor,
        contact=payload.contact,
        invoice_date=parsed_date,
        invoice_type=payload.invoice_type or "SALES",
        truck_no=payload.truck_no,
        total_weight=payload.total_weight,
        taxable_amount=payload.taxable_amount or 0.0,
        cgst_percent=payload.cgst_percent or 2.5,
        sgst_percent=payload.sgst_percent or 2.5,
        tax_amount=payload.tax_amount or 0.0,
        total_amount=payload.total_amount or 0.0,
        amount_paid=0.0,
        status="unpaid",
        notes=payload.notes
    )

    db.add(new_invoice)
    db.flush()

    for item in payload.items:
        db_item = InvoiceItemModel(
            invoice_id=new_invoice.id,
            description=item.description,
            hsn=item.hsn or "4819",
            unit=item.unit or "PCS",
            quantity=int(item.quantity),
            rate=item.rate,
            amount=item.amount
        )
        db.add(db_item)

    db.commit()
    db.refresh(new_invoice)

    return {
        "success": True,
        "message": "Invoice created successfully",
        "invoice_no": new_invoice.invoice_no,
        "id": new_invoice.id
    }

@app.delete("/api/invoices/{invoice_id}")
@app.delete("/invoices/{invoice_id}")
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    db.delete(inv)
    db.commit()
    return {"success": True}

if __name__ == "__main__":
    import uvicorn
    module_name = os.path.basename(__file__).replace(".py", "")
    uvicorn.run(f"{module_name}:app", host="0.0.0.0", port=8000, reload=True)