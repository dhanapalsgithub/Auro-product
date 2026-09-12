"""Backend tests for iteration 2: multi-item invoices, payments, ledger, reports, inventory, import, reminders."""
import io
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "bmartbuild4@gmail.com"
ADMIN_PASSWORD = "auro@2026"


@pytest.fixture(scope="module")
def client():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def a_shop(client):
    r = client.get(f"{API}/shops", params={"search": "TN1001"}, timeout=15)
    assert r.status_code == 200
    shops = r.json()
    assert shops, "TN1001 seed shop missing"
    return shops[0]


# ---------- Multi-item invoice ----------
class TestMultiItemInvoice:
    def test_two_line_items_totals(self, client, a_shop):
        payload = {
            "shop_id": a_shop["id"],
            "items": [
                {"description": "Cotton Box A", "hsn": "4819", "unit": "PCS", "quantity": 1000, "rate": 16},
                {"description": "Cotton Box B", "hsn": "4819", "unit": "PCS", "quantity": 500, "rate": 20},
            ],
        }
        r = client.post(f"{API}/invoices", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        inv = r.json()
        # taxable = 16000 + 10000 = 26000; 18% GST = 4680; total = 30680
        assert inv["taxable"] == 26000
        assert inv["cgst"] == 2340
        assert inv["sgst"] == 2340
        assert inv["grand_total"] == 30680
        assert inv["balance"] == 30680
        assert inv["status"] == "unpaid"
        assert len(inv["items"]) == 2
        assert inv["items"][0]["amount"] == 16000
        assert inv["items"][1]["amount"] == 10000
        # bank/upi fields present in seller (may be empty strings)
        assert "upi_id" in inv["seller"]
        assert "bank_name" in inv["seller"]
        # cleanup
        client.delete(f"{API}/invoices/{inv['id']}")


# ---------- Payments + status transitions ----------
class TestPaymentsAndLedger:
    def test_partial_then_full_payment(self, client, a_shop):
        # Create invoice grand_total=47200
        inv = client.post(f"{API}/invoices", json={
            "shop_id": a_shop["id"],
            "items": [{"description": "Cotton Box", "hsn": "4819", "unit": "PCS", "quantity": 2500, "rate": 16}],
        }, timeout=15).json()
        assert inv["grand_total"] == 47200
        inv_id = inv["id"]

        # Partial payment
        p1 = client.post(f"{API}/payments", json={"shop_id": a_shop["id"], "invoice_id": inv_id, "amount": 20000, "mode": "Cash"}, timeout=15)
        assert p1.status_code == 200
        got = client.get(f"{API}/invoices/{inv_id}").json()
        assert got["status"] == "partial"
        assert got["amount_paid"] == 20000
        assert got["balance"] == 27200

        # Remaining payment
        p2 = client.post(f"{API}/payments", json={"shop_id": a_shop["id"], "invoice_id": inv_id, "amount": 27200, "mode": "UPI"}, timeout=15)
        assert p2.status_code == 200
        got = client.get(f"{API}/invoices/{inv_id}").json()
        assert got["status"] == "paid"
        assert got["balance"] == 0.0

        # Payments list filtered by shop
        pl = client.get(f"{API}/payments", params={"shop_id": a_shop["id"]}).json()
        assert any(p["invoice_id"] == inv_id for p in pl)

        # Cleanup payments + invoice
        for pid in [p1.json()["id"], p2.json()["id"]]:
            client.delete(f"{API}/payments/{pid}")
        client.delete(f"{API}/invoices/{inv_id}")

    def test_ledger(self, client, a_shop):
        # Create one invoice + one payment to observe running balance
        inv = client.post(f"{API}/invoices", json={
            "shop_id": a_shop["id"],
            "items": [{"description": "Box", "hsn": "4819", "unit": "PCS", "quantity": 100, "rate": 10}],
        }).json()
        pay = client.post(f"{API}/payments", json={
            "shop_id": a_shop["id"], "invoice_id": inv["id"], "amount": 500, "mode": "Cash",
        }).json()
        led = client.get(f"{API}/ledger/{a_shop['id']}").json()
        assert "opening_balance" in led
        assert "closing_balance" in led
        assert "rows" in led and len(led["rows"]) >= 2
        assert led["total_debit"] >= inv["grand_total"]
        assert led["total_credit"] >= 500
        # Cleanup
        client.delete(f"{API}/payments/{pay['id']}")
        client.delete(f"{API}/invoices/{inv['id']}")


# ---------- Reports ----------
class TestReports:
    def test_daily(self, client):
        r = client.get(f"{API}/reports/daily")
        assert r.status_code == 200
        d = r.json()
        for k in ("day", "boxes", "waste_kg", "invoice_count", "invoice_total", "collections", "entries", "invoices", "payments"):
            assert k in d

    def test_monthly(self, client):
        r = client.get(f"{API}/reports/monthly")
        assert r.status_code == 200
        d = r.json()
        for k in ("month", "total_boxes", "total_waste", "total_invoiced", "total_collected", "outstanding", "daily"):
            assert k in d
        assert isinstance(d["daily"], list)


# ---------- Inventory ----------
class TestInventory:
    def test_inventory(self, client):
        r = client.get(f"{API}/inventory")
        assert r.status_code == 200
        d = r.json()
        assert "total_boxes" in d and "total_waste" in d and "active_shops" in d and "rows" in d
        assert len(d["rows"]) >= 149


# ---------- Bulk shop import ----------
class TestShopImport:
    def test_import_csv_updates_supervisor_contact(self, client):
        csv = "shop_no,supervisor,contact\nTN1001,TEST_Supervisor_X,9876543210\n"
        files = {"file": ("shops.csv", io.BytesIO(csv.encode("utf-8")), "text/csv")}
        r = client.post(f"{API}/shops/import", files=files)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["updated"] >= 1
        # Verify persistence
        shops = client.get(f"{API}/shops", params={"search": "TN1001"}).json()
        target = next(s for s in shops if s["shop_no"] == "TN1001")
        assert target["supervisor"] == "TEST_Supervisor_X"
        assert target["contact"] == "9876543210"
        # Restore (clear)
        client.put(f"{API}/shops/{target['id']}", json={"supervisor": "", "contact": ""})


# ---------- Reminders trigger ----------
class TestReminders:
    def test_run_reminders(self, client):
        r = client.post(f"{API}/reminders/run")
        assert r.status_code == 200
        d = r.json()
        assert d["triggered"] is True
        assert "due_count" in d
        assert isinstance(d["due_count"], int)

    def test_cron_requires_secret(self):
        r = requests.post(f"{API}/cron/reminders", headers={"Authorization": "Bearer wrong"}, timeout=15)
        assert r.status_code == 401


# ---------- Settings new fields ----------
class TestSettingsNewFields:
    def test_upi_and_reminder_persist(self, client):
        cur = client.get(f"{API}/settings").json()
        original = {k: cur.get(k, "") for k in ("upi_id", "reminder_email", "reminder_whatsapp", "bank_name", "account_no", "ifsc")}
        cur["upi_id"] = "auro@icici"
        cur["reminder_email"] = "bmartbuild4@gmail.com"
        cur["reminder_whatsapp"] = "+919999999999"
        cur["bank_name"] = "ICICI Bank"
        cur["account_no"] = "1234567890"
        cur["ifsc"] = "ICIC0000123"
        r = client.put(f"{API}/settings", json=cur)
        assert r.status_code == 200
        got = client.get(f"{API}/settings").json()
        assert got["upi_id"] == "auro@icici"
        assert got["reminder_email"] == "bmartbuild4@gmail.com"
        assert got["reminder_whatsapp"] == "+919999999999"
        assert got["bank_name"] == "ICICI Bank"
        # Restore
        for k, v in original.items():
            got[k] = v
        client.put(f"{API}/settings", json=got)
