"""Backend API tests for Auro Products billing system."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://tender-billing-tamil.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "bmartbuild4@gmail.com"
ADMIN_PASSWORD = "auro@2026"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# ---------- Auth ----------
class TestAuth:
    def test_login_ok(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
        assert data["user"]["email"] == ADMIN_EMAIL

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_ok(self, client):
        r = client.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL


# ---------- Shops ----------
class TestShops:
    def test_list_149_shops(self, client):
        r = client.get(f"{API}/shops", timeout=15)
        assert r.status_code == 200
        shops = r.json()
        assert len(shops) >= 149
        s0 = shops[0]
        for k in ("id", "shop_no", "name", "district", "location", "cycle_days"):
            assert k in s0

    def test_shops_search(self, client):
        r = client.get(f"{API}/shops", params={"search": "Chennai"}, timeout=15)
        assert r.status_code == 200
        assert all("Chennai" in (s.get("district", "") + s.get("location", "")) for s in r.json())

    def test_shops_district_filter(self, client):
        r = client.get(f"{API}/shops", params={"district": "Madurai"}, timeout=15)
        assert r.status_code == 200
        assert all(s["district"] == "Madurai" for s in r.json())

    def test_districts_list(self, client):
        r = client.get(f"{API}/shops/districts", timeout=15)
        assert r.status_code == 200
        assert "Chennai" in r.json()

    def test_shop_crud(self, client):
        # Create
        payload = {"shop_no": "TEST_9999", "name": "TEST_Shop", "district": "Trichy", "location": "TEST Area", "cycle_days": 3}
        r = client.post(f"{API}/shops", json=payload, timeout=15)
        assert r.status_code == 200
        sid = r.json()["id"]
        assert r.json()["shop_no"] == "TEST_9999"
        # Update
        r = client.put(f"{API}/shops/{sid}", json={"location": "Updated"}, timeout=15)
        assert r.status_code == 200 and r.json()["location"] == "Updated"
        # Verify via list
        r = client.get(f"{API}/shops", params={"search": "TEST_9999"}, timeout=15)
        assert any(s["id"] == sid for s in r.json())
        # Delete
        r = client.delete(f"{API}/shops/{sid}", timeout=15)
        assert r.status_code == 200


# ---------- Entries ----------
class TestEntries:
    def test_create_entry_waste_calc(self, client):
        shops = client.get(f"{API}/shops", timeout=15).json()
        sid = shops[0]["id"]
        r = client.post(f"{API}/entries", json={"shop_id": sid, "quantity": 2500}, timeout=15)
        assert r.status_code == 200
        e = r.json()
        assert e["quantity"] == 2500
        assert e["waste_kg"] == 208.33
        # Cleanup
        client.delete(f"{API}/entries/{e['id']}", timeout=15)

    def test_entry_shop_not_found(self, client):
        r = client.post(f"{API}/entries", json={"shop_id": "nope", "quantity": 100}, timeout=15)
        assert r.status_code == 404


# ---------- Invoices ----------
class TestInvoices:
    def test_create_invoice_totals(self, client):
        shops = client.get(f"{API}/shops", timeout=15).json()
        sid = shops[0]["id"]
        payload = {
            "shop_id": sid,
            "items": [{"description": "Cotton Box", "hsn": "4819", "unit": "PCS", "quantity": 2500, "rate": 16}],
        }
        r = client.post(f"{API}/invoices", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["taxable"] == 40000
        assert inv["cgst"] == 3600
        assert inv["sgst"] == 3600
        assert inv["grand_total"] == 47200
        assert inv["invoice_no"].startswith("AP")
        # GET
        r = client.get(f"{API}/invoices/{inv['id']}", timeout=15)
        assert r.status_code == 200 and r.json()["grand_total"] == 47200
        # Search
        r = client.get(f"{API}/invoices", params={"search": inv["invoice_no"]}, timeout=15)
        assert any(i["id"] == inv["id"] for i in r.json())
        # Delete
        r = client.delete(f"{API}/invoices/{inv['id']}", timeout=15)
        assert r.status_code == 200


# ---------- Dashboard & Analytics ----------
class TestDashboard:
    def test_dashboard(self, client):
        r = client.get(f"{API}/dashboard", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["stats"]["total_shops"] >= 149
        assert isinstance(d["reminders"], list)
        assert len(d["reminders"]) >= 149

    def test_waste_analytics(self, client):
        r = client.get(f"{API}/analytics/waste", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "by_shop" in d and "by_month" in d


# ---------- Settings ----------
class TestSettings:
    def test_get_settings(self, client):
        r = client.get(f"{API}/settings", timeout=15)
        assert r.status_code == 200
        s = r.json()
        assert s["company_name"] == "Auro Products"
        assert s["gstin"] == "33AITPM1982E1Z1"

    def test_update_settings_persists(self, client):
        cur = client.get(f"{API}/settings", timeout=15).json()
        original_phone = cur.get("phone", "")
        cur["phone"] = "9999999999"
        r = client.put(f"{API}/settings", json=cur, timeout=15)
        assert r.status_code == 200
        r2 = client.get(f"{API}/settings", timeout=15).json()
        assert r2["phone"] == "9999999999"
        # Restore
        cur["phone"] = original_phone
        client.put(f"{API}/settings", json=cur, timeout=15)
