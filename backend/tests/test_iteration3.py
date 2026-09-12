"""Iteration 3 backend tests: /api/collections, /api/overdue-nudge/run, /api/cron/overdue-nudge."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://tender-billing-tamil.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "bmartbuild4@gmail.com"
ADMIN_PASSWORD = "auro@2026"
CRON_SECRET = "d73cfe226fb8679a5b5565da856e3d7359fa8a71760d7070"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def shop(headers):
    r = requests.get(f"{API}/shops", headers=headers, timeout=15)
    assert r.status_code == 200
    shops = r.json()
    assert len(shops) > 0
    return shops[0]


# ---------- Overdue Nudge ----------
class TestOverdueNudge:
    def test_run_requires_auth(self):
        r = requests.post(f"{API}/overdue-nudge/run", timeout=15)
        assert r.status_code in (401, 403)

    def test_run_with_auth(self, headers):
        r = requests.post(f"{API}/overdue-nudge/run", headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("triggered") is True
        assert "nudge_count" in data
        assert isinstance(data["nudge_count"], int)

    def test_cron_without_secret_401(self):
        r = requests.post(f"{API}/cron/overdue-nudge", timeout=15)
        assert r.status_code == 401

    def test_cron_wrong_secret_401(self):
        r = requests.post(f"{API}/cron/overdue-nudge",
                          headers={"Authorization": "Bearer wrongsecret"}, timeout=15)
        assert r.status_code == 401

    def test_cron_correct_secret_200(self):
        r = requests.post(f"{API}/cron/overdue-nudge",
                          headers={"Authorization": f"Bearer {CRON_SECRET}"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json() == {"accepted": True}


# ---------- Collections ----------
class TestCollections:
    created_invoice_id = None
    created_payment_id = None
    shop_id = None
    shop_no = None

    def test_create_invoice_and_partial_payment(self, headers, shop):
        TestCollections.shop_id = shop["id"]
        TestCollections.shop_no = shop["shop_no"]
        # invoice qty 2500 rate 16 -> subtotal 40000, gst 18% => 47200
        payload = {
            "shop_id": shop["id"],
            "invoice_date": "2026-01-15",
            "items": [{"description": "Cotton Box", "hsn": "4819", "quantity": 2500, "rate": 16, "gst_rate": 18}],
        }
        r = requests.post(f"{API}/invoices", headers=headers, json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        inv = r.json()
        TestCollections.created_invoice_id = inv["id"]
        assert abs(inv["grand_total"] - 47200) < 0.5, f"expected 47200 got {inv['grand_total']}"

        # partial payment 10000
        pay = {"shop_id": shop["id"], "invoice_id": inv["id"], "amount": 10000, "mode": "cash",
               "date": "2026-01-16"}
        r2 = requests.post(f"{API}/payments", headers=headers, json=pay, timeout=15)
        assert r2.status_code in (200, 201), r2.text
        TestCollections.created_payment_id = r2.json()["id"]

    def test_collections_endpoint(self, headers, shop):
        r = requests.get(f"{API}/collections", headers=headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("total_outstanding", "shops_with_dues", "total_paid", "rows"):
            assert k in data
        # find our shop row
        our = [row for row in data["rows"] if row["shop_id"] == shop["id"]]
        assert len(our) == 1, f"expected 1 row for shop, got {len(our)}"
        row = our[0]
        # outstanding = opening + invoiced - paid
        assert abs(row["outstanding"] - (row["opening"] + row["invoiced"] - row["paid"])) < 0.01
        # invoiced should include 47200, paid should include 10000
        assert row["invoiced"] >= 47200 - 0.5
        assert row["paid"] >= 10000 - 0.5
        # rows sorted desc by outstanding
        outs = [r_["outstanding"] for r_ in data["rows"]]
        assert outs == sorted(outs, reverse=True)

    def test_cleanup(self, headers):
        if TestCollections.created_payment_id:
            requests.delete(f"{API}/payments/{TestCollections.created_payment_id}", headers=headers, timeout=15)
        if TestCollections.created_invoice_id:
            requests.delete(f"{API}/invoices/{TestCollections.created_invoice_id}", headers=headers, timeout=15)


# ---------- Regression sanity ----------
class TestRegression:
    def test_reports_daily(self, headers):
        r = requests.get(f"{API}/reports/daily?date=2026-01-15", headers=headers, timeout=15)
        assert r.status_code == 200

    def test_reports_monthly(self, headers):
        r = requests.get(f"{API}/reports/monthly?month=2026-01", headers=headers, timeout=15)
        assert r.status_code == 200

    def test_inventory(self, headers):
        r = requests.get(f"{API}/inventory", headers=headers, timeout=15)
        assert r.status_code == 200

    def test_invoices_list(self, headers):
        r = requests.get(f"{API}/invoices", headers=headers, timeout=15)
        assert r.status_code == 200

    def test_payments_list(self, headers):
        r = requests.get(f"{API}/payments", headers=headers, timeout=15)
        assert r.status_code == 200
