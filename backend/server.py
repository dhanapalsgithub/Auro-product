import os
import datetime
import json
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy import create_engine, ForeignKey, text, func
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship, Mapped, mapped_column

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL") or "postgresql://neondb_owner:npg_T2MhSB8cwrNl@ep-falling-shadow-b395z9yn-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
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

    shop: Mapped[Optional["ShopModel"]] = relationship()
    payments: Mapped[List["PaymentModel"]] = relationship(back_populates="entry", cascade="all, delete-orphan")


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
    mobile: Mapped[Optional[str]] = mapped_column(nullable=True)
    address: Mapped[Optional[str]] = mapped_column(nullable=True)
    supervisor: Mapped[Optional[str]] = mapped_column(nullable=True)
    invoice_date: Mapped[datetime.datetime] = mapped_column(nullable=False, default=datetime.datetime.utcnow)
    invoice_type: Mapped[Optional[str]] = mapped_column(default="SALES")
    waste_kg: Mapped[Optional[float]] = mapped_column(default=0.0)
    taxable_amount: Mapped[Optional[float]] = mapped_column(default=0.0)
    total_amount: Mapped[Optional[float]] = mapped_column(default=0.0)
    amount_paid: Mapped[Optional[float]] = mapped_column(default=0.0)
    status: Mapped[Optional[str]] = mapped_column(default="unpaid")
    
    shop: Mapped[Optional["ShopModel"]] = relationship()
    items: Mapped[List["InvoiceItemModel"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    payments: Mapped[List["PaymentModel"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItemModel(Base):
    __tablename__ = "invoice_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"), nullable=False)
    description: Mapped[str] = mapped_column(nullable=False)
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
    payment_date: Mapped[datetime.datetime] = mapped_column(default=datetime.datetime.utcnow)
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
        conn.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS waste_kg DOUBLE PRECISION DEFAULT 0.0;"))
        conn.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS taxable_amount DOUBLE PRECISION DEFAULT 0.0;"))
        conn.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS mobile VARCHAR;"))
        conn.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS address VARCHAR;"))
        conn.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS supervisor VARCHAR;"))
        conn.commit()

migrate_db()

app = FastAPI(title="Auro Product API", version="2.0")

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

class EntryCreate(BaseModel):
    shop_id: Optional[int] = None
    box_type: Optional[str] = "Cotton Box"
    brandy_qty: Optional[int] = 0
    brandy_rate: Optional[float] = 16.0
    beer_qty: Optional[int] = 0
    beer_rate: Optional[float] = 16.0
    quantity: Optional[int] = 0
    waste_kg: Optional[float] = 0.0
    taxable_amount: Optional[float] = 0.0
    cgst_amount: Optional[float] = 0.0
    sgst_amount: Optional[float] = 0.0
    total_amount: Optional[float] = 0.0
    entry_date: Optional[str] = None
    notes: Optional[str] = None


class ItemCreate(BaseModel):
    description: str
    quantity: int = 1
    rate: float = 0.0
    amount: Optional[float] = 0.0


class InvoiceCreate(BaseModel):
    invoice_no: Optional[str] = None
    shop_id: Optional[int] = None
    party_name: Optional[str] = None
    customer_name: Optional[str] = None
    location: Optional[str] = None
    supervisor: Optional[str] = None
    contact: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    invoice_date: Optional[str] = None
    invoice_type: Optional[str] = "SALES"
    truck_no: Optional[str] = None
    total_weight: Optional[float] = 0.0
    waste_kg: Optional[float] = 0.0
    taxable_amount: Optional[float] = 0.0
    total_amount: Optional[float] = 0.0
    amount_paid: Optional[float] = 0.0
    items: List[ItemCreate] = []


# --- API ENDPOINTS ---

@app.get("/api/dashboard")
@app.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    total_shops = db.query(func.count(ShopModel.id)).scalar() or 0
    total_boxes = db.query(func.coalesce(func.sum(EntryModel.quantity), 0.0)).scalar() or 0
    total_waste = db.query(func.coalesce(func.sum(EntryModel.waste_kg), 0.0)).scalar() or 0.0
    total_revenue = db.query(func.coalesce(func.sum(InvoiceModel.total_amount), 0.0)).filter(InvoiceModel.invoice_type == "SALES").scalar() or 0.0

    shops = db.query(ShopModel).all()
    today = datetime.datetime.utcnow().date()
    reminders = []

    for shop in shops:
        latest_entry = db.query(EntryModel).filter(EntryModel.shop_id == shop.id).order_by(EntryModel.entry_date.desc()).first()
        cycle = shop.cycle_days or 5
        if latest_entry and latest_entry.entry_date:
            last_date = latest_entry.entry_date.date()
            next_pickup_date = last_date + datetime.timedelta(days=cycle)
            days_diff = (next_pickup_date - today).days
            if days_diff < 0:
                status = "overdue"
            elif days_diff == 0:
                status = "due_today"
            else:
                status = "upcoming"
            next_pickup_str = next_pickup_date.isoformat()
        else:
            status = "no_entry"
            next_pickup_str = today.isoformat()

        reminders.append({
            "shop_id": shop.id,
            "shop_no": shop.shop_no,
            "shop_name": shop.name,
            "status": status,
            "next_pickup": next_pickup_str
        })

    return {
        "shops_count": int(total_shops),
        "total_boxes": int(total_boxes),
        "total_waste_kg": float(total_waste),
        "total_invoiced": float(total_revenue),
        "reminders": reminders
    }


@app.get("/api/shops")
@app.get("/shops")
def get_shops(search: Optional[str] = None, district: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(ShopModel)
    if search:
        query = query.filter((ShopModel.name.ilike(f"%{search}%")) | (ShopModel.shop_no.ilike(f"%{search}%")))
    if district:
        query = query.filter(ShopModel.district.ilike(f"%{district}%"))
    shops = query.all()
    return [{"id": s.id, "shop_no": s.shop_no, "name": s.name, "district": s.district, "location": s.location, "supervisor": s.supervisor, "contact": s.contact, "cycle_days": s.cycle_days} for s in shops]


@app.get("/api/settings/opening-balance")
@app.get("/settings/opening-balance")
def get_opening_balance(db: Session = Depends(get_db)):
    setting = db.query(SettingModel).filter(SettingModel.key == "opening_balance").first()
    history_setting = db.query(SettingModel).filter(SettingModel.key == "opening_balance_history").first()
    history = []
    if history_setting and history_setting.value:
        try:
            history = json.loads(history_setting.value)
        except Exception:
            history = []
    return {
        "opening_balance": float(setting.value) if setting and setting.value else 0.0,
        "history": history
    }

@app.get("/api/entries")
@app.get("/entries")
def get_entries(date: Optional[str] = None, shop_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(EntryModel)
    if date:
        try:
            start_dt = datetime.datetime.fromisoformat(date)
            end_dt = start_dt + datetime.timedelta(days=1)
            query = query.filter(EntryModel.entry_date >= start_dt, EntryModel.entry_date < end_dt)
        except Exception:
            pass
    if shop_id:
        query = query.filter(EntryModel.shop_id == shop_id)
        
    entries = query.order_by(EntryModel.entry_date.desc()).all()
    result = []
    for e in entries:
        shop_no = e.shop.shop_no if e.shop else "—"
        shop_name = e.shop.name if e.shop else "—"
        total_amt = e.total_amount or 0.0

        result.append({
            "id": e.id,
            "shop_id": e.shop_id,
            "shop_no": shop_no,
            "shop_name": shop_name,
            "brandy_qty": e.brandy_qty or 0,
            "beer_qty": e.beer_qty or 0,
            "quantity": e.quantity or 0,
            "waste_kg": e.waste_kg or 0.0,
            "opening_balance_deducted": e.opening_balance_deducted or 0.0,
            "total_amount": total_amt,
            "entry_date": e.entry_date.isoformat() if e.entry_date else None
        })
    return result


@app.post("/api/entries")
@app.post("/entries")
def create_entry(payload: EntryCreate, db: Session = Depends(get_db)):
    if payload.entry_date:
        try:
            entry_dt = datetime.datetime.fromisoformat(payload.entry_date)
        except Exception:
            entry_dt = datetime.datetime.utcnow()
    else:
        entry_dt = datetime.datetime.utcnow()

    total_qty = (payload.brandy_qty or 0) + (payload.beer_qty or 0)
    if total_qty == 0 and payload.quantity:
        total_qty = payload.quantity

    waste = payload.waste_kg
    if waste is None or waste == 0.0:
        waste = (payload.brandy_qty or 0) * 0.420

    new_entry = EntryModel(
        shop_id=payload.shop_id,
        box_type=payload.box_type,
        brandy_qty=payload.brandy_qty or 0,
        brandy_rate=payload.brandy_rate or 16.0,
        beer_qty=payload.beer_qty or 0,
        beer_rate=payload.beer_rate or 16.0,
        quantity=total_qty,
        waste_kg=float(waste),
        taxable_amount=payload.taxable_amount or 0.0,
        cgst_amount=payload.cgst_amount or 0.0,
        sgst_amount=payload.sgst_amount or 0.0,
        total_amount=payload.total_amount or 0.0,
        entry_date=entry_dt,
        notes=payload.notes
    )

    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)

    return {
        "message": "Entry created successfully",
        "id": new_entry.id,
        "shop_id": new_entry.shop_id,
        "quantity": new_entry.quantity,
        "total_amount": new_entry.total_amount
    }


@app.put("/api/entries/{entry_id}")
@app.put("/entries/{entry_id}")
def update_entry(entry_id: int, payload: EntryCreate, db: Session = Depends(get_db)):
    entry = db.query(EntryModel).filter(EntryModel.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    if payload.shop_id is not None:
        entry.shop_id = payload.shop_id
    if payload.box_type is not None:
        entry.box_type = payload.box_type
    if payload.brandy_qty is not None:
        entry.brandy_qty = payload.brandy_qty
    if payload.brandy_rate is not None:
        entry.brandy_rate = payload.brandy_rate
    if payload.beer_qty is not None:
        entry.beer_qty = payload.beer_qty
    if payload.beer_rate is not None:
        entry.beer_rate = payload.beer_rate
    
    total_qty = (entry.brandy_qty or 0) + (entry.beer_qty or 0)
    entry.quantity = total_qty
    
    waste = payload.waste_kg
    if waste is None or waste == 0.0:
        waste = (entry.brandy_qty or 0) * 0.420
    entry.waste_kg = float(waste)
    
    if payload.taxable_amount is not None:
        entry.taxable_amount = payload.taxable_amount
    if payload.cgst_amount is not None:
        entry.cgst_amount = payload.cgst_amount
    if payload.sgst_amount is not None:
        entry.sgst_amount = payload.sgst_amount
    if payload.total_amount is not None:
        entry.total_amount = payload.total_amount
        
    if payload.entry_date:
        try:
            entry.entry_date = datetime.datetime.fromisoformat(payload.entry_date)
        except Exception:
            pass
    if payload.notes is not None:
        entry.notes = payload.notes

    db.commit()
    db.refresh(entry)
    return {"message": "Entry updated successfully", "id": entry.id}


@app.delete("/api/entries/{entry_id}")
@app.delete("/entries/{entry_id}")
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(EntryModel).filter(EntryModel.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return {"message": "Entry deleted successfully"}


# --- INVOICE ENDPOINTS ---

@app.get("/api/invoices")
@app.get("/invoices")
def get_invoices(db: Session = Depends(get_db)):
    invoices = db.query(InvoiceModel).order_by(InvoiceModel.invoice_date.desc()).all()
    payments = db.query(PaymentModel).all()
    payment_map = {}
    for p in payments:
        if p.invoice_id:
            payment_map[p.invoice_id] = payment_map.get(p.invoice_id, 0.0) + (p.amount or 0.0)

    result = []
    for i in invoices:
        paid = payment_map.get(i.id, i.amount_paid or 0.0)
        tot = i.total_amount or 0.0
        if paid >= tot and tot > 0:
            status = "paid"
        elif paid > 0:
            status = "partial"
        else:
            status = "unpaid"

        items = [{"id": item.id, "description": item.description, "quantity": item.quantity, "rate": item.rate, "amount": item.amount} for item in i.items]

        result.append({
            "id": i.id,
            "invoice_no": i.invoice_no,
            "shop_id": i.shop_id,
            "shop_no": i.shop.shop_no if i.shop else "—",
            "shop_name": i.shop.name if i.shop else (i.party_name or i.customer_name or "—"),
            "party_name": i.party_name or i.customer_name or "—",
            "customer_name": i.customer_name or i.party_name or "—",
            "location": i.address or (i.shop.location if i.shop else ""),
            "supervisor": i.supervisor,
            "contact": i.mobile,
            "waste_kg": i.waste_kg or 0.0,
            "taxable_amount": i.taxable_amount or 0.0,
            "total_amount": tot,
            "amount_paid": float(paid),
            "status": status,
            "invoice_date": i.invoice_date.isoformat() if i.invoice_date else None,
            "items": items
        })
    return result


@app.get("/api/invoices/{invoice_id}")
@app.get("/invoices/{invoice_id}")
def get_single_invoice(invoice_id: int, db: Session = Depends(get_db)):
    i = db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    items = [{"id": item.id, "description": item.description, "quantity": item.quantity, "rate": item.rate, "amount": item.amount} for item in i.items]
    return {
        "id": i.id,
        "invoice_no": i.invoice_no,
        "shop_id": i.shop_id,
        "shop_no": i.shop.shop_no if i.shop else "—",
        "party_name": i.party_name or i.customer_name or "—",
        "customer_name": i.customer_name or i.party_name or "—",
        "location": i.address or "",
        "supervisor": i.supervisor,
        "contact": i.mobile,
        "waste_kg": i.waste_kg or 0.0,
        "taxable_amount": i.taxable_amount or 0.0,
        "total_amount": i.total_amount or 0.0,
        "amount_paid": i.amount_paid or 0.0,
        "status": i.status or "unpaid",
        "invoice_date": i.invoice_date.isoformat() if i.invoice_date else None,
        "items": items
    }


@app.post("/api/invoices")
@app.post("/invoices")
def create_invoice(payload: InvoiceCreate, db: Session = Depends(get_db)):
    if payload.invoice_date:
        try:
            inv_dt = datetime.datetime.fromisoformat(payload.invoice_date.replace("Z", "+00:00"))
        except Exception:
            inv_dt = datetime.datetime.utcnow()
    else:
        inv_dt = datetime.datetime.utcnow()

    # Auto-increment AP-INV-00001 sequence
    if not payload.invoice_no:
        last_inv = db.query(InvoiceModel).order_by(InvoiceModel.id.desc()).first()
        next_num = 1
        if last_inv and last_inv.invoice_no:
            parts = last_inv.invoice_no.split("-")
            if parts[-1].isdigit():
                next_num = int(parts[-1]) + 1
        inv_no = f"AP-INV-{next_num:05d}"
    else:
        inv_no = payload.invoice_no

    new_inv = InvoiceModel(
        invoice_no=inv_no,
        shop_id=payload.shop_id,
        party_name=payload.party_name or payload.customer_name or "Party",
        customer_name=payload.customer_name or payload.party_name or "Party",
        mobile=payload.contact or payload.mobile,
        address=payload.location or payload.address,
        supervisor=payload.supervisor,
        invoice_date=inv_dt,
        invoice_type=payload.invoice_type or "SALES",
        waste_kg=payload.waste_kg or 0.0,
        taxable_amount=payload.taxable_amount or 0.0,
        total_amount=payload.total_amount or 0.0,
        amount_paid=payload.amount_paid or 0.0,
        status="unpaid"
    )

    db.add(new_inv)
    db.commit()
    db.refresh(new_inv)

    for item in payload.items:
        new_item = InvoiceItemModel(
            invoice_id=new_inv.id,
            description=item.description,
            quantity=item.quantity,
            rate=item.rate,
            amount=item.amount or (item.quantity * item.rate)
        )
        db.add(new_item)

    db.commit()
    return {"message": "Invoice created successfully", "id": new_inv.id, "invoice_no": new_inv.invoice_no}


@app.put("/api/invoices/{invoice_id}")
@app.put("/invoices/{invoice_id}")
def update_invoice(invoice_id: int, payload: InvoiceCreate, db: Session = Depends(get_db)):
    inv = db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if payload.party_name:
        inv.party_name = payload.party_name
        inv.customer_name = payload.party_name
    if payload.location:
        inv.address = payload.location
    if payload.supervisor:
        inv.supervisor = payload.supervisor
    if payload.contact:
        inv.mobile = payload.contact
    if payload.taxable_amount is not None:
        inv.taxable_amount = payload.taxable_amount
    if payload.total_amount is not None:
        inv.total_amount = payload.total_amount
    if payload.waste_kg is not None:
        inv.waste_kg = payload.waste_kg

    db.query(InvoiceItemModel).filter(InvoiceItemModel.invoice_id == invoice_id).delete()
    for item in payload.items:
        new_item = InvoiceItemModel(
            invoice_id=inv.id,
            description=item.description,
            quantity=item.quantity,
            rate=item.rate,
            amount=item.amount or (item.quantity * item.rate)
        )
        db.add(new_item)

    db.commit()
    return {"message": "Invoice updated successfully", "id": inv.id}


@app.delete("/api/invoices/{invoice_id}")
@app.delete("/invoices/{invoice_id}")
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    db.delete(inv)
    db.commit()
    return {"message": "Invoice deleted successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)