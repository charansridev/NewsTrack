"""Product Inventory: admin adjust (stock origin), delivery allocation gate,
dispatch debit, delivered credit, and metadata PATCH."""

import pytest

from app.core.identity import create_user
from app.core.security import hash_password
from app.models.enums import UserRole


@pytest.fixture()
def world(client, admin):
    h = admin["headers"]
    press = client.post("/v1/organizations", headers=h, json={"name": "Press", "type": "Press"}).json()
    hub = client.post("/v1/organizations", headers=h, json={"name": "Hub", "type": "Hub"}).json()
    product = client.post("/v1/products", headers=h, json={"name": "Daily", "sku": "D1"}).json()
    return {"h": h, "press": press, "hub": hub, "product": product, "pid": product["product_id"]}


def _stock(client, w, org_id, qty, headers=None):
    return client.post("/v1/inventory", headers=headers or w["h"], json={
        "organization_id": org_id, "product_id": w["pid"], "set_quantity": qty})


def _create_delivery(client, w, inventory_id, qty):
    return client.post("/v1/deliveries", headers=w["h"], json={
        "type": "Delivery",
        "sender": {"universal_id": w["press"]["universal_id"]},
        "recipient": {"universal_id": w["hub"]["universal_id"]},
        "allocations": [{"inventory_id": inventory_id, "expected_quantity": qty}],
    })


def _inv_row(client, w, org_id):
    rows = client.get(f"/v1/inventory?organization_id={org_id}&product_id={w['pid']}",
                     headers=w["h"]).json()["data"]
    return rows[0] if rows else None


def test_admin_adjust_creates_inventory(client, world):
    w = world
    r = _stock(client, w, w["press"]["id"], 5000)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["current_stock"] == 5000 and body["received_stock"] == 5000
    assert body["status"] == "Available"


def test_delivery_requires_sender_inventory(client, world):
    w = world
    inv = _stock(client, w, w["press"]["id"], 100).json()
    # Ask for more than available -> 400.
    r = _create_delivery(client, w, inv["inventory_id"], 500)
    assert r.status_code == 400
    assert any(d["field"] == inv["inventory_id"] for d in r.json()["error"]["details"])


def test_allocation_must_belong_to_sender(client, world):
    """An inventory record owned by the hub cannot be used as a Press sender allocation."""
    w = world
    _stock(client, w, w["press"]["id"], 5000)
    hub_inv = _stock(client, w, w["hub"]["id"], 5000).json()
    r = _create_delivery(client, w, hub_inv["inventory_id"], 100)
    assert r.status_code == 400


def test_dispatch_debits_and_deliver_credits(client, world):
    w = world
    h = w["h"]
    inv = _stock(client, w, w["press"]["id"], 5000).json()
    did = _create_delivery(client, w, inv["inventory_id"], 1200).json()["id"]

    client.post(f"/v1/deliveries/{did}/status", headers=h, json={"status": "Packed"})
    assert _inv_row(client, w, w["press"]["id"])["current_stock"] == 5000   # unchanged

    client.post(f"/v1/deliveries/{did}/status", headers=h, json={"status": "Dispatched"})
    assert _inv_row(client, w, w["press"]["id"])["current_stock"] == 3800   # 5000 - 1200

    client.post(f"/v1/deliveries/{did}/status", headers=h, json={"status": "OutForDelivery"})
    client.post(f"/v1/deliveries/{did}/status", headers=h, json={"status": "Delivered"})
    hub_row = _inv_row(client, w, w["hub"]["id"])
    assert hub_row["current_stock"] == 1200 and hub_row["received_stock"] == 1200


def test_metadata_patch_does_not_touch_stock(client, world):
    w = world
    inv = _stock(client, w, w["hub"]["id"], 100).json()
    r = client.patch(f"/v1/inventory/{inv['inventory_id']}", headers=w["h"],
                    json={"status": "Reserved", "other_info": {"bay": "A1"}})
    assert r.status_code == 200
    assert r.json()["status"] == "Reserved"
    assert r.json()["current_stock"] == 100        # unchanged


def test_adjust_permission(client, world, db):
    w = world
    vendor = client.post("/v1/organizations", headers=w["h"],
                        json={"name": "Vend", "type": "Vendor"}).json()
    create_user(db, organization_id=vendor["id"], name="Val", email="val@x.com",
                role=UserRole.Vendor, password_hash=hash_password("p"))
    db.commit()
    tok = client.post("/v1/auth/login", json={"email": "val@x.com", "password": "p"}).json()["access_token"]
    vh = {"Authorization": f"Bearer {tok}"}

    # Own org -> ok; another org -> 403.
    assert _stock(client, w, vendor["id"], 50, headers=vh).status_code == 201
    assert _stock(client, w, w["press"]["id"], 50, headers=vh).status_code == 403


def test_org_inventory_listing(client, world):
    w = world
    _stock(client, w, w["press"]["id"], 5000)
    rows = client.get(f"/v1/inventory/organization/{w['press']['id']}", headers=w["h"]).json()["data"]
    assert len(rows) == 1 and rows[0]["product_id"] == w["pid"]
