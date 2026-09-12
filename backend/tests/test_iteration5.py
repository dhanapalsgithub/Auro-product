"""Iteration 5 tests: new admin credentials, /api/statement, waste by_type_month, regression basics."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://tender-billing-tamil.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "dhanapaul2020@gmail.com"
ADMIN_PASS = "dhana@123"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and data["user"]["email"] == ADMIN_EMAIL
    return data["token"]


@pytest.fixture(scope="module")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


def test_auth_me(client):
    r = client.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN_EMAIL


def test_bad_login_401():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=30)
    assert r.status_code == 401


def test_shops_count(client):
    r = client.get(f"{BASE_URL}/api/shops")
    assert r.status_code == 200
    shops = r.json()
    assert len(shops) >= 149


def test_analytics_waste_by_type_month(client):
    r = client.get(f"{BASE_URL}/api/analytics/waste")
    assert r.status_code == 200
    data = r.json()
    assert "by_type_month" in data
    assert isinstance(data["by_type_month"], list)
    for row in data["by_type_month"]:
        assert set(["month", "beer", "brandy"]).issubset(row.keys())


@pytest.fixture(scope="module")
def test_shop(client):
    r = client.get(f"{BASE_URL}/api/shops")
    return r.json()[0]


def test_statement_full_flow(client, test_shop):
    shop_id = test_shop["id"]
    # Create invoice
    inv_payload = {
        "shop_id": shop_id,
        "items": [{"description": "Beer Bottle Cotton Box", "hsn": "4819", "unit": "PCS", "quantity": 1000, "rate": 16}],
        "cgst_percent": 9, "sgst_percent": 9,
    }
    r = client.post(f"{BASE_URL}/api/invoices", json=inv_payload)
    assert r.status_code == 200, r.text
    inv = r.json()
    assert inv["grand_total"] == 18880
    inv_id = inv["id"]

    # Partial payment
    r = client.post(f"{BASE_URL}/api/payments", json={"shop_id": shop_id, "invoice_id": inv_id, "amount": 5000, "mode": "Cash"})
    assert r.status_code == 200, r.text
    pay_id = r.json()["id"]

    # Statement for current month range
    from datetime import datetime, timezone
    start = datetime.now(timezone.utc).replace(day=1).date().isoformat()
    end = datetime.now(timezone.utc).date().isoformat()
    r = client.get(f"{BASE_URL}/api/statement/{shop_id}", params={"start": start, "end": end})
    assert r.status_code == 200, r.text
    st = r.json()
    for k in ["opening_balance", "rows", "total_debit", "total_credit", "closing_balance"]:
        assert k in st
    assert st["total_debit"] >= 18880
    assert st["total_credit"] >= 5000
    assert abs(st["closing_balance"] - (st["opening_balance"] + st["total_debit"] - st["total_credit"])) < 0.5
    # Running balance present
    assert all("balance" in row for row in st["rows"])

    # Cleanup
    client.delete(f"{BASE_URL}/api/payments/{pay_id}")
    client.delete(f"{BASE_URL}/api/invoices/{inv_id}")


def test_statement_shop_not_found(client):
    r = client.get(f"{BASE_URL}/api/statement/nonexistent-id")
    assert r.status_code == 404


def test_regression_dashboard(client):
    r = client.get(f"{BASE_URL}/api/dashboard")
    assert r.status_code == 200
    assert "stats" in r.json() and "reminders" in r.json()


def test_regression_inventory(client):
    r = client.get(f"{BASE_URL}/api/inventory")
    assert r.status_code == 200
    d = r.json()
    assert "by_type" in d and "rows" in d


def test_regression_reports(client):
    r = client.get(f"{BASE_URL}/api/reports/daily")
    assert r.status_code == 200
    r = client.get(f"{BASE_URL}/api/reports/monthly")
    assert r.status_code == 200


def test_regression_collections(client):
    r = client.get(f"{BASE_URL}/api/collections")
    assert r.status_code == 200


def test_regression_box_entry_with_brandy(client, test_shop):
    r = client.post(f"{BASE_URL}/api/entries", json={
        "shop_id": test_shop["id"], "box_type": "Brandy Bottle Cotton Box", "quantity": 120
    })
    assert r.status_code == 200
    e = r.json()
    assert e["box_type"] == "Brandy Bottle Cotton Box"
    assert e["waste_kg"] == 10.0
    client.delete(f"{BASE_URL}/api/entries/{e['id']}")
