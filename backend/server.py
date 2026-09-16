import os
import datetime
import json
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Optional, Union, List
from fastapi import FastAPI, HTTPException, Depends, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, func
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from collections import defaultdict

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL") or "postgresql://neondb_owner:npg_T2MhSB8cwrNl@ep-falling-shadow-b395z9yn-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- Database Models ---
class ShopModel(Base):
    __tablename__ = "shops"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    shop_no = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    district = Column(String, nullable=True)
    location = Column(String, nullable=True)
    supervisor = Column(String, nullable=True)
    contact = Column(String, nullable=True)
    cycle_days = Column(Integer, default=5)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class EntryModel(Base):
    __tablename__ = "entries"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    box_type = Column(String, nullable=True)
    quantity = Column(Integer, nullable=False)
    waste_kg = Column(Float, nullable=False, default=0.0)
    entry_date = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class InventoryModel(Base):
    __tablename__ = "inventory"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    item_name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    stock_qty = Column(Integer, default=0)
    unit = Column(String, default="pcs")
    unit_price = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class InvoiceModel(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    invoice_no = Column(String, unique=True, index=True, nullable=False)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=True)
    customer_name = Column(String, nullable=False)
    gstin = Column(String, nullable=True)
    invoice_type = Column(String, default="SALES")
    item_description = Column(String, nullable=True)
    quantity = Column(Float, default=1.0)
    unit = Column(String, default="pcs")
    rate = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    taxable_value = Column(Float, default=0.0)
    cgst_percent = Column(Float, default=2.5)
    cgst_amount = Column(Float, default=0.0)
    sgst_percent = Column(Float, default=2.5)
    sgst_amount = Column(Float, default=0.0)
    round_off = Column(Float, default=0.0)
    grand_total = Column(Float, default=0.0)
    amount_paid = Column(Float, default=0.0)
    balance = Column(Float, default=0.0)
    invoice_date = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default="Paid")

class LedgerModel(Base):
    __tablename__ = "ledger"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    amount = Column(Float, nullable=False)
    transaction_type = Column(String, default="Credit")
    payment_mode = Column(String, default="UPI")
    reference_no = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    transaction_date = Column(DateTime, default=datetime.datetime.utcnow)

class CollectionModel(Base):
    __tablename__ = "collections"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    collected_amount = Column(Float, nullable=False)
    collection_date = Column(DateTime, default=datetime.datetime.utcnow)
    collected_by = Column(String, nullable=True)
    status = Column(String, default="Completed")

class SettingsModel(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    key_name = Column(String, unique=True, index=True, nullable=False)
    key_value = Column(String, nullable=False)

class UserModel(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(String, default="viewer")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

Base.metadata.create_all(bind=engine)

def seed_database():
    db = SessionLocal()
    try:
        # Seed initial users
        default_users = [
            {"email": "dhanapaul2020@gmail.com", "password": "dhana@123", "role": "admin"},
            {"email": "userone@gmail.com", "password": "0ne@123", "role": "admin"},
            {"email": "usertwo@gmail.com", "password": "two@123", "role": "viewer"},
            {"email": "userthree@gmail.com", "password": "three@123", "role": "viewer"},
        ]
        for u_data in default_users:
            existing_user = db.query(UserModel).filter(UserModel.email == u_data["email"]).first()
            if not existing_user:
                db.add(UserModel(**u_data))
        db.commit()

        if db.query(ShopModel).count() == 0:
            districts = ["Chennai", "Coimbatore", "Madurai", "Salem", "Trichy"]
            for i in range(1, 11):
                shop = ShopModel(
                    shop_no=f"SHOP-{100+i}",
                    name=f"Auro Wine Mart {i}",
                    district=districts[i % len(districts)],
                    location=f"Area Zone {i}",
                    supervisor=f"Supervisor {i}",
                    contact=f"98765432{i:02d}",
                    cycle_days=5
                )
                db.add(shop)
            db.commit()

        if db.query(SettingsModel).filter(SettingsModel.key_name == "global_opening_balance").count() == 0:
            db.add(SettingsModel(key_name="global_opening_balance", key_value="0.0"))
            db.commit()

        if db.query(SettingsModel).count() <= 1:
            settings_data = [
                ("waste_divisor", "10"),
                ("company_name", "Auro Products Billing Suite"),
                ("address", "123 Industrial Estate, Coimbatore"),
                ("gstin", "33AABCA0000A1Z5"),
                ("state", "Tamil Nadu"),
                ("state_code", "33"),
                ("phone", "9876543210"),
                ("email", "support@auroproducts.com"),
                ("bank_name", "HDFC Bank"),
                ("account_no", "123456789012"),
                ("ifsc", "HDFC0001234"),
                ("upi_id", "auroproducts@okhdfcbank"),
                ("terms", "Goods once sold will not be taken back."),
                ("tax_rate", "18"),
                ("currency", "INR"),
                ("auto_backup", "enabled")
            ]
            for k, v in settings_data:
                existing = db.query(SettingsModel).filter(SettingsModel.key_name == k).first()
                if not existing:
                    db.add(SettingsModel(key_name=k, key_value=v))
            db.commit()
    except Exception as e:
        print(f"Seeding error: {e}")
        db.rollback()
    finally:
        db.close()

seed_database()

app = FastAPI(title="Auro Product API", version="1.0")

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

# --- Pydantic Schemas ---
class LoginRequest(BaseModel):
    email: str
    password: str

class ShopCreate(BaseModel):
    shop_no: str
    name: str
    district: Optional[str] = None
    location: Optional[str] = None
    supervisor: Optional[str] = None
    contact: Optional[str] = None
    cycle_days: int = 5

class EntryCreate(BaseModel):
    shop_id: int
    box_type: Optional[str] = None
    quantity: int
    waste_kg: float = 0.0
    entry_date: Optional[str] = None
    notes: Optional[str] = None

class InventoryCreate(BaseModel):
    item_name: str
    category: Optional[str] = None
    stock_qty: int = 0
    unit: str = "pcs"
    unit_price: float = 0.0

class InvoiceItemCreate(BaseModel):
    description: Optional[str] = "General Goods"
    hsn: Optional[str] = ""
    unit: Optional[str] = "pcs"
    quantity: float = 1.0
    rate: float = 0.0
    amount: float = 0.0

class InvoiceCreate(BaseModel):
    invoice_no: Optional[str] = None
    customer_name: Optional[str] = None
    shop_id: Optional[int] = None
    gstin: Optional[str] = None
    invoice_type: Optional[str] = "SALES"
    items: Optional[List[InvoiceItemCreate]] = []
    item_description: Optional[str] = None
    quantity: Optional[float] = 1.0
    unit: Optional[str] = "pcs"
    rate: Optional[float] = 0.0
    total_amount: float
    tax_amount: float
    taxable_value: Optional[float] = 0.0
    cgst_percent: Optional[float] = 2.5
    cgst_amount: Optional[float] = 0.0
    sgst_percent: Optional[float] = 2.5
    sgst_amount: Optional[float] = 0.0
    round_off: Optional[float] = 0.0
    grand_total: Optional[float] = 0.0
    amount_paid: Optional[float] = 0.0
    balance: Optional[float] = 0.0
    invoice_date: Optional[str] = None
    status: str = "Paid"

class LedgerCreate(BaseModel):
    shop_id: Union[int, str]
    invoice_id: Optional[Union[int, str]] = None
    amount: float
    transaction_type: Optional[str] = "Credit"
    mode: Optional[str] = "UPI"
    payment_mode: Optional[str] = None
    reference_no: Optional[str] = None
    notes: Optional[str] = None
    payment_date: Optional[str] = None
    transaction_date: Optional[str] = None

class CollectionCreate(BaseModel):
    shop_id: Union[int, str]
    collected_amount: float
    collection_date: Optional[str] = None
    collected_by: Optional[str] = None
    status: str = "Completed"

class SettingsUpdate(BaseModel):
    key_name: str
    key_value: str

@app.get("/")
def read_root():
    return {"message": "Auro Product API is running!"}

# --- AUTHENTICATION ENDPOINT ---
@app.post("/api/login")
def login_user(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.email == payload.email).first()
    if not user or user.password != payload.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    return {
        "success": True,
        "email": user.email,
        "role": user.role,
        "message": "Login successful"
    }

# --- SHOPS CRUD ---
@app.get("/api/shops")
def get_shops(search: Optional[str] = None, district: Optional[str] = None, db = Depends(get_db)):
    query = db.query(ShopModel)
    if search:
        query = query.filter(ShopModel.name.ilike(f"%{search}%") | ShopModel.shop_no.ilike(f"%{search}%"))
    if district:
        query = query.filter(ShopModel.district.ilike(f"%{district}%"))
    return query.all()

@app.post("/api/shops")
def create_shop(shop: ShopCreate, db = Depends(get_db)):
    db_shop = ShopModel(**shop.dict())
    db.add(db_shop)
    db.commit()
    db.refresh(db_shop)
    return {"success": True, "data": db_shop}

@app.put("/api/shops/{shop_id}")
def update_shop(shop_id: int, shop: ShopCreate, db = Depends(get_db)):
    db_shop = db.query(ShopModel).filter(ShopModel.id == shop_id).first()
    if not db_shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    for key, value in shop.dict().items():
        setattr(db_shop, key, value)
    db.commit()
    db.refresh(db_shop)
    return {"success": True, "data": db_shop}

@app.delete("/api/shops/{shop_id}")
def delete_shop(shop_id: int, db = Depends(get_db)):
    shop = db.query(ShopModel).filter(ShopModel.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    try:
        db.query(EntryModel).filter(EntryModel.shop_id == shop_id).delete()
        db.query(LedgerModel).filter(LedgerModel.shop_id == shop_id).delete()
        
        db.delete(shop)
        db.commit()
        return {"success": True, "message": "Shop and associated records deleted"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Cannot delete shop because it has active ledger or box entries.")

@app.get("/api/shops/districts")
def get_shop_districts(db = Depends(get_db)):
    districts = db.query(ShopModel.district).distinct().all()
    return [d[0] for d in districts if d[0]]

# --- ENTRIES CRUD ---
@app.get("/api/entries")
def get_entries(db = Depends(get_db)):
    return db.query(EntryModel).order_by(EntryModel.entry_date.desc()).all()

@app.post("/api/entries")
def create_entry(entry: EntryCreate, db = Depends(get_db)):
    parsed_date = datetime.datetime.utcnow()
    if entry.entry_date:
        try:
            parsed_date = datetime.datetime.fromisoformat(str(entry.entry_date).replace("Z", "+00:00"))
        except Exception:
            pass
    db_entry = EntryModel(
        shop_id=entry.shop_id,
        box_type=entry.box_type,
        quantity=entry.quantity,
        waste_kg=entry.waste_kg,
        entry_date=parsed_date,
        notes=entry.notes
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return {"success": True, "data": db_entry}

@app.put("/api/entries/{entry_id}")
def update_entry(entry_id: int, entry: EntryCreate, db = Depends(get_db)):
    db_entry = db.query(EntryModel).filter(EntryModel.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    parsed_date = db_entry.entry_date
    if entry.entry_date:
        try:
            parsed_date = datetime.datetime.fromisoformat(str(entry.entry_date).replace("Z", "+00:00"))
        except Exception:
            pass

    db_entry.shop_id = entry.shop_id
    db_entry.box_type = entry.box_type
    db_entry.quantity = entry.quantity
    db_entry.waste_kg = entry.waste_kg
    db_entry.entry_date = parsed_date
    db_entry.notes = entry.notes

    db.commit()
    db.refresh(db_entry)
    return {"success": True, "data": db_entry}

@app.delete("/api/entries/{entry_id}")
def delete_entry(entry_id: int, db = Depends(get_db)):
    db_entry = db.query(EntryModel).filter(EntryModel.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(db_entry)
    db.commit()
    return {"success": True}

# --- INVENTORY CRUD ---
@app.get("/api/inventory")
def get_inventory_dashboard(db = Depends(get_db)):
    total_boxes = db.query(func.sum(EntryModel.quantity)).scalar() or 0
    total_waste = db.query(func.sum(EntryModel.waste_kg)).scalar() or 0.0
    active_shops = db.query(ShopModel).count()

    by_type_query = db.query(
        EntryModel.box_type,
        func.sum(EntryModel.quantity).label("boxes"),
        func.sum(EntryModel.waste_kg).label("waste")
    ).group_by(EntryModel.box_type).all()

    by_type = [{"type": t.box_type or "General", "boxes": t.boxes or 0, "waste": round(t.waste or 0.0, 2)} for t in by_type_query]

    shops = db.query(ShopModel).all()
    rows = []
    for shop in shops:
        shop_entries = db.query(EntryModel).filter(EntryModel.shop_id == shop.id).all()
        shop_boxes = sum([e.quantity for e in shop_entries])
        shop_waste = sum([e.waste_kg for e in shop_entries])
        rows.append({
            "shop_no": shop.shop_no,
            "name": shop.name,
            "location": shop.location or "",
            "total_boxes": shop_boxes,
            "total_waste": round(shop_waste, 2),
            "entries": len(shop_entries),
            "last_entry": max([e.entry_date for e in shop_entries]).isoformat() if shop_entries else None
        })

    items = db.query(InventoryModel).all()
    return {
        "total_boxes": total_boxes,
        "total_waste": round(total_waste, 2),
        "active_shops": active_shops,
        "by_type": by_type,
        "rows": rows,
        "items": items
    }

@app.post("/api/settings/opening-balance-history")
def update_opening_balance(payload: dict, db = Depends(get_db)):
    amount = float(payload.get("opening_balance", 0))
    mode = payload.get("mode", "replace")
    
    setting = db.query(SettingsModel).filter(SettingsModel.key_name == "opening_balance").first()
    
    current_val = 0.0
    history = []
    
    if setting:
        try:
            old_data = json.loads(setting.key_value)
            current_val = float(old_data.get("opening_balance", 0))
            history = old_data.get("history", [])
        except:
            pass

    final_balance = (current_val + amount) if mode == "add" else amount
    
    history.insert(0, {
        "amount": amount,
        "total_after": final_balance,
        "mode": mode,
        "timestamp": payload.get("timestamp", datetime.datetime.utcnow().isoformat())
    })
    
    new_data_str = json.dumps({
        "opening_balance": final_balance,
        "history": history
    })
    
    if setting:
        setting.key_value = new_data_str
    else:
        new_setting = SettingsModel(key_name="opening_balance", key_value=new_data_str)
        db.add(new_setting)
        
    db.commit()
    return {"opening_balance": final_balance, "history": history}

@app.post("/api/inventory")
def create_inventory_item(item: InventoryCreate, db = Depends(get_db)):
    db_item = InventoryModel(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return {"success": True, "data": db_item}

@app.delete("/api/inventory/{item_id}")
def delete_inventory_item(item_id: int, db = Depends(get_db)):
    db_item = db.query(InventoryModel).filter(InventoryModel.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    db.delete(db_item)
    db.commit()
    return {"success": True}

# --- INVOICES CRUD ---
@app.get("/api/invoices")
def get_invoices(
    search: Optional[str] = Query(None),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(InvoiceModel)
    if search and search.strip():
        search_filter = f"%{search.strip()}%"
        query = query.filter(
            (InvoiceModel.invoice_no.ilike(search_filter)) | 
            (InvoiceModel.customer_name.ilike(search_filter)) |
            (InvoiceModel.item_description.ilike(search_filter))
        )
    if start and start.strip():
        try:
            start_date = datetime.date.fromisoformat(start.strip())
            query = query.filter(InvoiceModel.invoice_date >= start_date)
        except ValueError:
            pass
    if end and end.strip():
        try:
            end_date = datetime.date.fromisoformat(end.strip())
            query = query.filter(InvoiceModel.invoice_date <= end_date)
        except ValueError:
            pass
            
    invoices = query.order_by(InvoiceModel.invoice_date.desc()).all()
    results = []
    for inv in invoices:
        shop = db.query(ShopModel).filter(ShopModel.id == inv.shop_id).first() if inv.shop_id else None
        results.append({
            "id": inv.id,
            "invoice_no": inv.invoice_no,
            "shop_id": inv.shop_id,
            "shop_name": shop.name if shop else (inv.customer_name or "Walk-in Customer"),
            "customer_name": inv.customer_name,
            "gstin": inv.gstin,
            "invoice_type": inv.invoice_type or "SALES",
            "total_amount": inv.grand_total or inv.total_amount or 0.0,
            "tax_amount": inv.tax_amount or 0.0,
            "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
            "status": inv.status or "Completed"
        })
    return results

@app.get("/api/invoices/{invoice_id}")
def get_invoice_detail(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    shop = db.query(ShopModel).filter(ShopModel.id == inv.shop_id).first() if inv.shop_id else None
    settings_records = db.query(SettingsModel).all()
    settings_map = {s.key_name: s.key_value for s in settings_records}
    
    seller_data = {
        "name": settings_map.get("company_name", "Auro Products"),
        "address": settings_map.get("address", ""),
        "gstin": settings_map.get("gstin", ""),
        "state": settings_map.get("state", ""),
        "state_code": settings_map.get("state_code", ""),
        "phone": settings_map.get("phone", ""),
        "email": settings_map.get("email", ""),
        "bank_name": settings_map.get("bank_name", ""),
        "account_no": settings_map.get("account_no", ""),
        "ifsc": settings_map.get("ifsc", ""),
        "upi_id": settings_map.get("upi_id", ""),
        "terms": settings_map.get("terms", "")
    }

    items_data = [
        {
            "description": inv.item_description or inv.customer_name or "General Goods",
            "hsn": "",
            "quantity": inv.quantity or 1.0,
            "unit": inv.unit or "pcs",
            "rate": inv.rate or (inv.taxable_value / inv.quantity) if (inv.quantity and inv.quantity > 0) else (inv.taxable_value or inv.total_amount or 0.0),
            "amount": inv.taxable_value or inv.total_amount or 0.0
        }
    ]

    return {
        "id": inv.id,
        "invoice_no": inv.invoice_no,
        "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
        "shop_id": inv.shop_id,
        "shop_no": shop.shop_no if shop else "—",
        "shop_name": shop.name if shop else (inv.customer_name or "Walk-in Customer"),
        "shop_location": shop.location if shop else "",
        "shop_district": shop.district if shop else "",
        "invoice_type": inv.invoice_type or "SALES",
        "items": items_data,
        "taxable": inv.taxable_value or 0.0,
        "cgst_percent": inv.cgst_percent or 2.5,
        "cgst": inv.cgst_amount or 0.0,
        "sgst_percent": inv.sgst_percent or 2.5,
        "sgst": inv.sgst_amount or 0.0,
        "round_off": inv.round_off or 0.0,
        "grand_total": inv.grand_total or inv.total_amount or 0.0,
        "amount_paid": inv.amount_paid or 0.0,
        "balance": inv.balance or 0.0,
        "seller": seller_data
    }

@app.post("/api/invoices")
def create_invoice(invoice: InvoiceCreate, db = Depends(get_db)):
    parsed_date = datetime.datetime.utcnow()
    if invoice.invoice_date:
        try:
            parsed_date = datetime.datetime.fromisoformat(str(invoice.invoice_date).replace("Z", "+00:00"))
        except Exception:
            pass

    first_item = invoice.items[0] if invoice.items and len(invoice.items) > 0 else None
    
    item_desc = (
        (first_item.description if first_item else None) or 
        invoice.item_description or 
        invoice.customer_name or 
        "General Goods"
    )
    qty = (
        (first_item.quantity if first_item else None) or 
        invoice.quantity or 
        1.0
    )
    unit_val = (
        (first_item.unit if first_item else None) or 
        invoice.unit or 
        "pcs"
    )
    rate_val = (
        (first_item.rate if first_item else None) or 
        invoice.rate or 
        0.0
    )

    tot = invoice.total_amount
    tax = invoice.tax_amount
    grand = invoice.grand_total if invoice.grand_total else tot
    taxable = invoice.taxable_value or (tot - tax)
    
    if rate_val == 0.0 and qty > 0 and taxable > 0:
        rate_val = taxable / qty

    db_inv = InvoiceModel(
        invoice_no=invoice.invoice_no or f"INV-{datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        shop_id=invoice.shop_id,
        customer_name=invoice.customer_name or "Walk-in Customer",
        gstin=invoice.gstin,
        invoice_type=invoice.invoice_type or "SALES",
        item_description=item_desc,
        quantity=qty,
        unit=unit_val,
        rate=rate_val,
        total_amount=tot,
        tax_amount=tax,
        taxable_value=taxable,
        cgst_percent=invoice.cgst_percent or 2.5,
        cgst_amount=invoice.cgst_amount or (tax / 2),
        sgst_percent=invoice.sgst_percent or 2.5,
        sgst_amount=invoice.sgst_amount or (tax / 2),
        round_off=invoice.round_off or 0.0,
        grand_total=grand,
        amount_paid=invoice.amount_paid or 0.0,
        balance=invoice.balance or 0.0,
        invoice_date=parsed_date,
        status=invoice.status
    )
    db.add(db_inv)
    db.commit()
    db.refresh(db_inv)
    return {"success": True, "data": db_inv}

@app.put("/api/invoices/{invoice_id}")
def update_invoice(invoice_id: int, invoice: InvoiceCreate, db = Depends(get_db)):
    db_inv = db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).first()
    if not db_inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    parsed_date = db_inv.invoice_date
    if invoice.invoice_date:
        try:
            parsed_date = datetime.datetime.fromisoformat(str(invoice.invoice_date).replace("Z", "+00:00"))
        except Exception:
            pass

    first_item = invoice.items[0] if invoice.items and len(invoice.items) > 0 else None
    
    item_desc = (
        (first_item.description if first_item else None) or 
        invoice.item_description or 
        invoice.customer_name or 
        db_inv.item_description or 
        "General Goods"
    )
    qty = (
        (first_item.quantity if first_item else None) or 
        invoice.quantity or 
        db_inv.quantity or 
        1.0
    )
    unit_val = (
        (first_item.unit if first_item else None) or 
        invoice.unit or 
        db_inv.unit or 
        "pcs"
    )
    rate_val = (
        (first_item.rate if first_item else None) or 
        invoice.rate or 
        db_inv.rate or 
        0.0
    )

    tot = invoice.total_amount
    tax = invoice.tax_amount
    grand = invoice.grand_total if invoice.grand_total else tot
    taxable = invoice.taxable_value or (tot - tax)
    
    if rate_val == 0.0 and qty > 0 and taxable > 0:
        rate_val = taxable / qty

    db_inv.invoice_no = invoice.invoice_no or db_inv.invoice_no
    db_inv.shop_id = invoice.shop_id if invoice.shop_id is not None else db_inv.shop_id
    db_inv.customer_name = invoice.customer_name or db_inv.customer_name
    db_inv.gstin = invoice.gstin if invoice.gstin is not None else db_inv.gstin
    db_inv.invoice_type = invoice.invoice_type or db_inv.invoice_type
    db_inv.item_description = item_desc
    db_inv.quantity = qty
    db_inv.unit = unit_val
    db_inv.rate = rate_val
    db_inv.total_amount = tot
    db_inv.tax_amount = tax
    db_inv.taxable_value = taxable
    db_inv.cgst_percent = invoice.cgst_percent if invoice.cgst_percent is not None else db_inv.cgst_percent
    db_inv.cgst_amount = invoice.cgst_amount if invoice.cgst_amount is not None else (tax / 2)
    db_inv.sgst_percent = invoice.sgst_percent if invoice.sgst_percent is not None else db_inv.sgst_percent
    db_inv.sgst_amount = invoice.sgst_amount if invoice.sgst_amount is not None else (tax / 2)
    db_inv.round_off = invoice.round_off if invoice.round_off is not None else db_inv.round_off
    db_inv.grand_total = grand
    db_inv.amount_paid = invoice.amount_paid if invoice.amount_paid is not None else db_inv.amount_paid
    db_inv.balance = invoice.balance if invoice.balance is not None else db_inv.balance
    db_inv.invoice_date = parsed_date
    db_inv.status = invoice.status or db_inv.status

    db.commit()
    db.refresh(db_inv)
    return {"success": True, "data": db_inv}

@app.delete("/api/invoices/{invoice_id}")
def delete_invoice(invoice_id: int, db = Depends(get_db)):
    db_inv = db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).first()
    if not db_inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    db.delete(db_inv)
    db.commit()
    return {"success": True}

# --- PAYMENTS & LEDGER CRUD ---
@app.get("/api/payments")
def get_payments(shop_id: Optional[int] = Query(None), db = Depends(get_db)):
    query = db.query(LedgerModel)
    if shop_id:
        query = query.filter(LedgerModel.shop_id == shop_id)
    payments = query.order_by(LedgerModel.transaction_date.desc()).all()
    results = []
    for p in payments:
        shop = db.query(ShopModel).filter(ShopModel.id == p.shop_id).first() if p.shop_id else None
        invoice = db.query(InvoiceModel).filter(InvoiceModel.id == p.invoice_id).first() if p.invoice_id else None
        results.append({
            "id": p.id,
            "shop_id": p.shop_id,
            "shop_no": shop.shop_no if shop else "N/A",
            "shop_name": shop.name if shop else "Unknown",
            "invoice_id": p.invoice_id,
            "invoice_no": invoice.invoice_no if invoice else None,
            "amount": p.amount,
            "transaction_type": p.transaction_type,
            "payment_mode": p.payment_mode,
            "mode": p.payment_mode,
            "reference_no": p.reference_no,
            "notes": p.notes,
            "payment_date": p.transaction_date.isoformat() if p.transaction_date else None,
            "transaction_date": p.transaction_date.isoformat() if p.transaction_date else None
        })
    return results

@app.post("/api/payments")
def create_payment(ledger: LedgerCreate, db = Depends(get_db)):
    try:
        parsed_date = datetime.datetime.utcnow()
        date_val = ledger.payment_date or ledger.transaction_date
        if date_val:
            try:
                parsed_date = datetime.datetime.fromisoformat(str(date_val).replace("Z", "+00:00"))
            except Exception:
                pass

        pay_mode = ledger.mode or ledger.payment_mode or "UPI"
        tx_type = ledger.transaction_type or "Credit"
        s_id = int(ledger.shop_id)

        db_ledger = LedgerModel(
            shop_id=s_id,
            invoice_id=int(ledger.invoice_id) if ledger.invoice_id else None,
            amount=ledger.amount,
            transaction_type=tx_type,
            payment_mode=pay_mode,
            reference_no=ledger.reference_no,
            notes=ledger.notes,
            transaction_date=parsed_date
        )
        db.add(db_ledger)
        db.commit()
        db.refresh(db_ledger)
        return {"success": True, "data": db_ledger}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/payments/{payment_id}")
def update_payment(payment_id: int, ledger: LedgerCreate, db = Depends(get_db)):
    db_pay = db.query(LedgerModel).filter(LedgerModel.id == payment_id).first()
    if not db_pay:
        raise HTTPException(status_code=404, detail="Payment record not found")
    try:
        parsed_date = db_pay.transaction_date
        date_val = ledger.payment_date or ledger.transaction_date
        if date_val:
            try:
                parsed_date = datetime.datetime.fromisoformat(str(date_val).replace("Z", "+00:00"))
            except Exception:
                pass

        pay_mode = ledger.mode or ledger.payment_mode or db_pay.payment_mode or "UPI"
        tx_type = ledger.transaction_type or db_pay.transaction_type or "Credit"
        s_id = int(ledger.shop_id) if ledger.shop_id is not None else db_pay.shop_id

        db_pay.shop_id = s_id
        db_pay.invoice_id = int(ledger.invoice_id) if ledger.invoice_id else db_pay.invoice_id
        db_pay.amount = ledger.amount
        db_pay.transaction_type = tx_type
        db_pay.payment_mode = pay_mode
        db_pay.reference_no = ledger.reference_no
        db_pay.notes = ledger.notes
        db_pay.transaction_date = parsed_date

        db.commit()
        db.refresh(db_pay)
        return {"success": True, "data": db_pay}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/payments/{payment_id}")
def delete_payment(payment_id: int, db = Depends(get_db)):
    db_pay = db.query(LedgerModel).filter(LedgerModel.id == payment_id).first()
    if not db_pay:
        raise HTTPException(status_code=404, detail="Payment record not found")
    db.delete(db_pay)
    db.commit()
    return {"success": True}

# --- GLOBAL OPENING BALANCE SETTINGS ENDPOINTS ---
@app.post("/api/settings/opening-balance")
def update_global_opening_balance(payload: dict, db: Session = Depends(get_db)):
    balance_val = payload.get("opening_balance", 0.0)
    update_mode = payload.get("mode", "replace") 
    entry_date = payload.get("entry_date", datetime.datetime.now().strftime("%Y-%m-%d"))
    entered_by = payload.get("entered_by", "Admin")
    
    try:
        balance_val = float(balance_val)
    except (ValueError, TypeError):
        balance_val = 0.0
    
    setting = db.query(SettingsModel).filter(SettingsModel.key_name == "global_opening_balance").first()
    history_setting = db.query(SettingsModel).filter(SettingsModel.key_name == "global_opening_balance_history").first()
    
    history_list = []
    if history_setting and history_setting.key_value:
        try:
            history_list = json.loads(history_setting.key_value)
        except:
            history_list = []

    current_val = float(setting.key_value) if setting and setting.key_value else 0.0
    
    if update_mode == "add":
        new_total = current_val + balance_val
    else:
        new_total = balance_val
        
    history_entry = {
        "amount": balance_val,
        "mode": update_mode,
        "entry_date": entry_date,
        "entered_by": entered_by,
        "timestamp": datetime.datetime.now().isoformat(),
        "total_after": new_total
    }
    history_list.insert(0, history_entry)

    if setting:
        setting.key_value = str(new_total)
    else:
        db.add(SettingsModel(key_name="global_opening_balance", key_value=str(new_total)))
        
    if history_setting:
        history_setting.key_value = json.dumps(history_list)
    else:
        db.add(SettingsModel(key_name="global_opening_balance_history", key_value=json.dumps(history_list)))
        
    db.commit()
    
    return {
        "success": True, 
        "opening_balance": new_total,
        "history": history_list
    }

@app.get("/api/settings/opening-balance")
def get_global_opening_balance(db: Session = Depends(get_db)):
    setting = db.query(SettingsModel).filter(SettingsModel.key_name == "global_opening_balance").first()
    history_setting = db.query(SettingsModel).filter(SettingsModel.key_name == "global_opening_balance_history").first()
    
    val = float(setting.key_value) if setting and setting.key_value else 0.0
    history_list = []
    if history_setting and history_setting.key_value:
        try:
            history_list = json.loads(history_setting.key_value)
        except:
            history_list = []
            
    return {
        "opening_balance": val,
        "history": history_list
    }

# --- COLLECTIONS WITH GLOBAL OPENING BALANCE ---
@app.get("/api/collections")
def get_collections(db = Depends(get_db)):
    shops = db.query(ShopModel).all()
    settings_records = db.query(SettingsModel).all()
    settings_map = {s.key_name: s.key_value for s in settings_records}
    try:
        global_opening = float(settings_map.get("global_opening_balance", 0.0))
    except ValueError:
        global_opening = 0.0

    results = []
    total_outstanding_all = 0.0
    shops_with_dues_count = 0
    total_collected_all = 0.0
    total_revenue_all = 0.0
    total_purchases_all = 0.0

    for shop in shops:
        invoices = db.query(InvoiceModel).filter(InvoiceModel.shop_id == shop.id).all()
        payments = db.query(LedgerModel).filter(LedgerModel.shop_id == shop.id).all()
        
        purchase_amount = sum([inv.grand_total if (inv.grand_total and inv.grand_total > 0) else (inv.total_amount or 0) for inv in invoices if inv.invoice_type and inv.invoice_type.strip().upper() == "PURCHASE"])
        
        sales_invoices = [inv for inv in invoices if not inv.invoice_type or inv.invoice_type.strip().upper() in ["SALES", "WORK SALE"]]
        total_invoiced = sum([inv.grand_total if (inv.grand_total and inv.grand_total > 0) else (inv.total_amount or 0) for inv in sales_invoices])
        
        total_paid = sum([p.amount for p in payments if p.amount and p.transaction_type == "Credit"])

        total_revenue_all += total_invoiced
        total_purchases_all += purchase_amount
        total_collected_all += total_paid

        shop_opening = global_opening if shop.id == shops[0].id else 0.0 
        
        outstanding = (shop_opening - purchase_amount) + total_invoiced - total_paid
        if outstanding < 0:
            outstanding = 0.0

        if outstanding > 0:
            shops_with_dues_count += 1

        total_outstanding_all += outstanding

        results.append({
            "id": shop.id,
            "shop_id": shop.id,
            "shop_no": shop.shop_no,
            "shop_name": shop.name,
            "name": shop.name,
            "location": shop.location or "—",
            "opening": shop_opening,
            "purchase_amount": purchase_amount,
            "invoiced": total_invoiced,
            "paid": total_paid,
            "outstanding": outstanding
        })

    net_profit_val = total_revenue_all - total_purchases_all

    return {
        "global_opening_balance": global_opening,
        "total_revenue": total_revenue_all,
        "total_purchases": total_purchases_all,
        "net_profit": net_profit_val,
        "total_outstanding": total_outstanding_all,
        "shops_with_dues": shops_with_dues_count,
        "total_collected": total_collected_all,
        "records": results,
        "rows": results,
        "data": results
    }

@app.post("/api/collections")
def create_collection(col: CollectionCreate, db = Depends(get_db)):
    try:
        parsed_date = datetime.datetime.utcnow()
        if col.collection_date:
            try:
                parsed_date = datetime.datetime.fromisoformat(str(col.collection_date).replace("Z", "+00:00"))
            except Exception:
                pass

        db_col = CollectionModel(
            shop_id=int(col.shop_id),
            collected_amount=col.collected_amount,
            collection_date=parsed_date,
            collected_by=col.collected_by,
            status=col.status
        )
        db.add(db_col)
        db.commit()
        db.refresh(db_col)
        return {"success": True, "data": db_col}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/collections/{col_id}")
def delete_collection(col_id: int, db = Depends(get_db)):
    db_col = db.query(CollectionModel).filter(CollectionModel.id == col_id).first()
    if not db_col:
        raise HTTPException(status_code=404, detail="Collection not found")
    db.delete(db_col)
    db.commit()
    return {"success": True}

# --- SETTINGS CRUD ---
@app.get("/api/settings")
def get_settings(db = Depends(get_db)):
    settings = db.query(SettingsModel).all()
    return {s.key_name: s.key_value for s in settings}

@app.post("/api/settings")
def update_setting(setting: SettingsUpdate, db = Depends(get_db)):
    db_setting = db.query(SettingsModel).filter(SettingsModel.key_name == setting.key_name).first()
    if db_setting:
        db_setting.key_value = setting.key_value
    else:
        db_setting = SettingsModel(key_name=setting.key_name, key_value=setting.key_value)
        db.add(db_setting)
    db.commit()
    return {"success": True, "data": {setting.key_name: setting.key_value}}

# --- REPORTS & ANALYTICS ---
@app.get("/api/reports/daily")
def get_daily_report(day: str = None, db = Depends(get_db)):
    if not day:
        day = datetime.datetime.now().strftime("%Y-%m-%d")
    
    invoices = db.query(InvoiceModel).all()
    day_invoices = []
    
    purchase_total = 0.0
    sale_total = 0.0
    purchase_gst = 0.0
    sale_gst = 0.0
    total_collections = 0.0

    for inv in invoices:
        inv_date_obj = getattr(inv, "created_at", None) or getattr(inv, "date", None) or getattr(inv, "invoice_date", None)
        inv_date_str = ""
        if inv_date_obj:
            inv_date_str = str(inv_date_obj)[:10]
        
        if inv_date_str == day:
            shop = db.query(ShopModel).filter(ShopModel.id == inv.shop_id).first() if hasattr(inv, "shop_id") else None
            inv_type = (getattr(inv, "invoice_type", None) or "SALES").strip().upper()
            g_total = float(getattr(inv, "grand_total", 0) if (getattr(inv, "grand_total", 0) and getattr(inv, "grand_total", 0) > 0) else getattr(inv, "total_amount", 0) or 0)
            
            gst_amount = float(getattr(inv, "gst_amount", 0) or getattr(inv, "tax_amount", 0) or (g_total * 0.05 / 1.05))

            if inv_type == "PURCHASE":
                purchase_total += g_total
                purchase_gst += gst_amount
            else:
                sale_total += g_total
                sale_gst += gst_amount

            day_invoices.append({
                "id": getattr(inv, "id", 0),
                "invoice_no": getattr(inv, "invoice_no", None) or f"INV-{getattr(inv, 'id', 0)}",
                "shop_no": shop.shop_no if shop else "—",
                "shop_name": shop.name if shop else "—",
                "invoice_type": inv_type,
                "grand_total": g_total
            })

    payments = db.query(LedgerModel).all() if 'LedgerModel' in globals() else []
    for p in payments:
        p_date_obj = getattr(p, "date", None) or getattr(p, "created_at", None)
        p_date_str = str(p_date_obj)[:10] if p_date_obj else ""
        if p_date_str == day and getattr(p, "transaction_type", "") == "Credit":
            total_collections += float(getattr(p, "amount", 0) or 0)

    return {
        "day": day,
        "purchase_invoice_total": purchase_total,
        "sale_invoice_total": sale_total,
        "gst_collected_sales": sale_gst,
        "gst_collected_purchase": purchase_gst,
        "collections": total_collections,
        "invoices": day_invoices
    }

@app.get("/api/reports/monthly")
def get_monthly_report(month: str = None, db = Depends(get_db)):
    if not month:
        month = datetime.datetime.now().strftime("%Y-%m")
    
    invoices = db.query(InvoiceModel).all()
    payments = db.query(LedgerModel).all() if 'LedgerModel' in globals() else []
    
    daily_map = {}
    purchase_total = 0.0
    sale_total = 0.0
    purchase_gst = 0.0
    sale_gst = 0.0
    total_collected = 0.0
    
    for inv in invoices:
        inv_date_obj = getattr(inv, "created_at", None) or getattr(inv, "date", None) or getattr(inv, "invoice_date", None)
        inv_date_str = str(inv_date_obj)[:10] if inv_date_obj else ""
            
        if inv_date_str.startswith(month):
            inv_type = (getattr(inv, "invoice_type", None) or "SALES").strip().upper()
            g_total = float(getattr(inv, "grand_total", 0) if (getattr(inv, "grand_total", 0) and getattr(inv, "grand_total", 0) > 0) else getattr(inv, "total_amount", 0) or 0)
            gst_amount = float(getattr(inv, "gst_amount", 0) or getattr(inv, "tax_amount", 0) or (g_total * 0.05 / 1.05))

            if inv_type == "PURCHASE":
                purchase_total += g_total
                purchase_gst += gst_amount
            else:
                sale_total += g_total
                sale_gst += gst_amount
                
            if inv_date_str not in daily_map:
                daily_map[inv_date_str] = {"date": inv_date_str, "sale": 0.0, "purchase": 0.0}
            if inv_type == "PURCHASE":
                daily_map[inv_date_str]["purchase"] += g_total
            else:
                daily_map[inv_date_str]["sale"] += g_total

    for p in payments:
        p_date_obj = getattr(p, "date", None) or getattr(p, "created_at", None)
        p_date_str = str(p_date_obj)[:10] if p_date_obj else ""
        if p_date_str.startswith(month) and getattr(p, "transaction_type", "") == "Credit":
            total_collected += float(getattr(p, "amount", 0) or 0)

    sorted_daily = sorted(list(daily_map.values()), key=lambda x: x["date"])

    return {
        "month": month,
        "purchase_invoice_total": purchase_total,
        "sale_invoice_total": sale_total,
        "gst_collected_sales": sale_gst,
        "gst_collected_purchase": purchase_gst,
        "total_collected": total_collected,
        "daily": sorted_daily
    }

@app.get("/api/statement/{shop_id}")
def get_shop_statement(shop_id: int, start: str = None, end: str = None, db = Depends(get_db)):
    shop = db.query(ShopModel).filter(ShopModel.id == shop_id).first()
    if not shop:
        return {"error": "Shop not found"}

    settings_records = db.query(SettingsModel).all()
    settings_map = {s.key_name: s.key_value for s in settings_records}
    try:
        global_opening = float(settings_map.get("global_opening_balance", 0.0))
    except ValueError:
        global_opening = 0.0

    invoices = db.query(InvoiceModel).filter(InvoiceModel.shop_id == shop_id).all()
    payments = db.query(LedgerModel).filter(LedgerModel.shop_id == shop_id).all()

    rows = []
    
    total_purchase_inv = 0.0
    total_sale_inv = 0.0
    gst_collected_sales = 0.0
    gst_collected_purchase = 0.0

    for inv in invoices:
        inv_date = getattr(inv, "date", None) or getattr(inv, "created_at", None) or "2026-09-15"
        inv_type = (getattr(inv, "invoice_type", None) or "SALES").strip().upper()
        amount = float(getattr(inv, "grand_total", 0) if (getattr(inv, "grand_total", 0) and getattr(inv, "grand_total", 0) > 0) else getattr(inv, "total_amount", 0) or 0)
        
        gst_amount = float(getattr(inv, "gst_amount", 0) or getattr(inv, "tax_amount", 0) or (amount * 0.05 / 1.05))

        particulars = f"Invoice: {getattr(inv, 'invoice_no', 'INV')}"
        if inv_type == "PURCHASE":
            particulars = f"Purchase GST: {getattr(inv, 'invoice_no', 'INV')}"
            total_purchase_inv += amount
            gst_collected_purchase += gst_amount
            rows.append({
                "date": str(inv_date)[:10],
                "particulars": particulars,
                "debit": amount,
                "credit": 0.0,
                "type": "PURCHASE"
            })
        else:
            total_sale_inv += amount
            gst_collected_sales += gst_amount
            rows.append({
                "date": str(inv_date)[:10],
                "particulars": particulars,
                "debit": 0.0,
                "credit": amount,
                "type": "SALES"
            })

    for p in payments:
        p_date = getattr(p, "date", None) or getattr(p, "created_at", None) or "2026-09-15"
        amt = float(getattr(p, "amount", 0) or 0)
        t_type = getattr(p, "transaction_type", "Credit")
        
        rows.append({
            "date": str(p_date)[:10],
            "particulars": f"Payment Received ({t_type})",
            "debit": amt if t_type == "Debit" else 0.0,
            "credit": amt if t_type == "Credit" else 0.0,
            "type": "PAYMENT"
        })

    rows = sorted(rows, key=lambda x: x["date"])

    opening_balance = global_opening if shop_id == 1 else 0.0 
    running_balance = opening_balance
    
    final_rows = []
    total_debit = 0.0
    total_credit = 0.0

    for r in rows:
        debit = r["debit"]
        credit = r["credit"]
        total_debit += debit
        total_credit += credit
        
        running_balance = running_balance + debit - credit
        
        final_rows.append({
            "date": r["date"],
            "particulars": r["particulars"],
            "debit": debit,
            "credit": credit,
            "balance": running_balance
        })

    seller_info = {
        "name": settings_map.get("company_name", "Auro Products"),
        "address": settings_map.get("company_address", "Tiruchirappalli"),
        "gstin": settings_map.get("company_gstin", "33AAAAA0000A1Z5")
    }

    return {
        "seller": seller_info,
        "shop": {
            "id": shop.id,
            "shop_no": shop.shop_no,
            "name": shop.name,
            "location": shop.location
        },
        "start": start or "2026-09-01",
        "end": end or "2026-09-30",
        "opening_balance": opening_balance,
        "rows": final_rows,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "closing_balance": running_balance,
        "total_purchase": total_purchase_inv,
        "total_sale": total_sale_inv,
        "gst_collected_sales": gst_collected_sales,
        "gst_collected_purchase": gst_collected_purchase
    }

@app.get("/api/analytics/waste")
def get_waste_analytics(db = Depends(get_db)):
    try:
        box_entries = db.query(EntryModel).all()
    except Exception:
        box_entries = []
    
    total_boxes = sum([b.quantity for b in box_entries if b and b.quantity])
    total_waste = sum([b.waste_kg for b in box_entries if b and b.waste_kg])
    
    shop_waste = {}
    month_waste = defaultdict(float)
    type_month_waste = defaultdict(lambda: {"beer": 0.0, "brandy": 0.0})

    for b in box_entries:
        if not b:
            continue
        
        shop = db.query(ShopModel).filter(ShopModel.id == b.shop_id).first()
        s_name = shop.name if shop else "Unknown"
        if s_name not in shop_waste:
            shop_waste[s_name] = {"shop": s_name, "boxes": 0, "waste": 0.0}
        shop_waste[s_name]["boxes"] += getattr(b, "quantity", 0) or 0
        shop_waste[s_name]["waste"] += getattr(b, "waste_kg", 0) or 0

        entry_date = getattr(b, "date", None) or getattr(b, "created_at", None)
        if entry_date:
            if isinstance(entry_date, str):
                try:
                    parsed_date = datetime.datetime.fromisoformat(entry_date)
                except ValueError:
                    parsed_date = datetime.datetime.now()
            else:
                parsed_date = entry_date
            
            month_key = parsed_date.strftime("%b %Y")
            waste_val = getattr(b, "waste_kg", 0) or 0
            
            month_waste[month_key] += waste_val

            item_type = str(getattr(b, "item_type", "") or getattr(b, "product_name", "")).lower()
            if "beer" in item_type:
                type_month_waste[month_key]["beer"] += waste_val
            elif "brandy" in item_type:
                type_month_waste[month_key]["brandy"] += waste_val
            else:
                type_month_waste[month_key]["beer"] += waste_val / 2
                type_month_waste[month_key]["brandy"] += waste_val / 2

    by_shop = list(shop_waste.values())
    by_month = [{"month": k, "waste": v} for k, v in month_waste.items()]
    by_type_month = [
        {"month": k, "beer": v["beer"], "brandy": v["brandy"]} 
        for k, v in type_month_waste.items()
    ]

    return {
        "total_boxes": total_boxes,
        "total_waste": total_waste,
        "by_shop": by_shop,
        "by_month": by_month,
        "by_type_month": by_type_month
    }

# --- DASHBOARD ENDPOINT ---
@app.get("/api/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    total_shops = db.query(ShopModel).count()
    total_boxes = db.query(func.coalesce(func.sum(EntryModel.quantity), 0)).scalar()
    
    waste_divisor = 12.0
    setting_row = db.query(SettingsModel).filter(SettingsModel.key_name == "waste_divisor").first()
    if setting_row and setting_row.key_value:
        try:
            waste_divisor = float(setting_row.key_value)
        except ValueError:
            pass
            
    total_waste_kg = round(total_boxes / waste_divisor, 2)
    
    invoices = db.query(InvoiceModel).all()
    settings_records = db.query(SettingsModel).all()
    settings_map = {s.key_name: s.key_value for s in settings_records}
    try:
        global_opening = float(settings_map.get("global_opening_balance", 0.0))
    except ValueError:
        global_opening = 0.0
    
    sales_invoices = [inv for inv in invoices if not inv.invoice_type or inv.invoice_type.strip().upper() in ["SALES", "WORK SALE"]]
    purchase_invoices = [inv for inv in invoices if inv.invoice_type and inv.invoice_type.strip().upper() == "PURCHASE"]
    
    total_revenue = sum([inv.grand_total if (inv.grand_total and inv.grand_total > 0) else (inv.total_amount or 0) for inv in sales_invoices])
    total_purchases_with_gst = sum([inv.grand_total if (inv.grand_total and inv.grand_total > 0) else (inv.total_amount or 0) for inv in purchase_invoices])
    
    net_profit = total_revenue - total_purchases_with_gst

    adjusted_opening_balance = global_opening - total_purchases_with_gst

    total_collected = db.query(func.coalesce(func.sum(LedgerModel.amount), 0)).filter(LedgerModel.transaction_type == "Credit").scalar()
    
    outstanding_balance = adjusted_opening_balance + total_revenue - total_collected
    if outstanding_balance < 0:
        outstanding_balance = 0.0

    reminders = []
    overdue_count = 0
    due_today_count = 0
    upcoming_count = 0
    today = datetime.datetime.utcnow().date()

    shops = db.query(ShopModel).all()
    for shop in shops:
        latest_entry = db.query(EntryModel).filter(EntryModel.shop_id == shop.id).order_by(EntryModel.entry_date.desc()).first()
        cycle_days = shop.cycle_days or 7
        
        if not latest_entry:
            status = "no_entry"
            next_pickup = None
            last_entry_date = None
            overdue_count += 1
        else:
            last_entry_date = latest_entry.entry_date
            if isinstance(last_entry_date, datetime.datetime):
                entry_date_obj = last_entry_date.date()
            elif isinstance(last_entry_date, str):
                try:
                    entry_date_obj = datetime.datetime.fromisoformat(last_entry_date[:10]).date()
                except Exception:
                    entry_date_obj = today
            else:
                entry_date_obj = last_entry_date
                
            next_pickup = entry_date_obj + timedelta(days=cycle_days)
            delta_days = (today - next_pickup).days
            if delta_days > 0:
                status = "overdue"
                overdue_count += 1
            elif delta_days == 0:
                status = "due_today"
                due_today_count += 1
            else:
                status = "upcoming"
                upcoming_count += 1

        reminders.append({
            "shop_id": shop.id,
            "shop_no": shop.shop_no,
            "shop_name": shop.name,
            "location": shop.location,
            "cycle_days": cycle_days,
            "last_entry": str(last_entry_date) if last_entry_date else None,
            "next_pickup": str(next_pickup) if next_pickup else None,
            "status": status
        })

    recent_invoices = db.query(InvoiceModel).order_by(InvoiceModel.id.desc()).limit(5).all()

    return {
        "shops_count": total_shops,
        "total_boxes": total_boxes,
        "total_waste_kg": total_waste_kg,
        "opening_balance": round(adjusted_opening_balance, 2),
        "raw_opening_balance": round(global_opening, 2),
        "total_purchase_with_gst": round(total_purchases_with_gst, 2),
        "total_invoiced": total_revenue,
        "total_revenue": round(total_revenue, 2),
        "net_profit": round(net_profit, 2),
        "outstanding_balance": round(outstanding_balance, 2),
        "overdue_count": overdue_count,
        "due_today_count": due_today_count,
        "upcoming_count": upcoming_count,
        "reminders": reminders,
        "recent_invoices": [
            {
                "id": i.id,
                "invoice_no": i.invoice_no,
                "shop_no": "",
                "shop_name": i.customer_name,
                "total_amount": i.grand_total if (i.grand_total and i.grand_total > 0) else i.total_amount
            } for i in recent_invoices
        ]
    }
import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)