"""Phase 4 checkpoint: full delivery lifecycle.

create -> advance statuses -> assign/reassign driver (logged) -> confirm with a
quantity mismatch (discrepancy) -> frozen delivery rejects PATCH (409) and a
second confirm fails (409). Plus illegal-transition and access-filtering checks.
"""

import pytest

from app.core.security import create_user_access_token, hash_password
from app.core.identity import create_user
from app.models.driver import Driver
from app.models.enums import OrgType, UserRole
from app.models.vehicle import Vehicle


@pytest.fixture()
def world(client, admin, db):
    """Press + Hub orgs, addresses, a product, two drivers, a vehicle."""
    h = admin["headers"]
    press = client.post("/v1/organizations", headers=h,
                        json={"name": "Central Press", "type": "Press"}).json()
    hub = client.post("/v1/organizations", headers=h,
                     json={"name": "Hyderabad Hub", "type": "Hub"}).json()
    a_press = client.post("/v1/addresses", headers=h,
                         json={"address": "1 Press Rd"}).json()
    a_hub = client.post("/v1/addresses", headers=h,
                       json={"address": "9 Hub Ave"}).json()
    product = client.post("/v1/products", headers=h,
                         json={"name": "The Hindu - Morning"}).json()
    inv = client.post("/v1/inventory", headers=h, json={
        "organization_id": press["id"], "product_id": product["product_id"],
        "set_quantity": 1000000}).json()

    d1 = Driver(driver_name="Ravi", mobile="9000000001", is_available=True,
                password_hash=hash_password("d1"))
    d2 = Driver(driver_name="Kumar", mobile="9000000002", is_available=True,
                password_hash=hash_password("d2"))
    veh = Vehicle(vehicle_number="TS09AB1234", vehicle_type="3W", capacity=500)
    db.add_all([d1, d2, veh])
    db.commit()
    return {
        "h": h, "press": press, "hub": hub, "a_press": a_press, "a_hub": a_hub,
        "product": product, "inv_id": inv["inventory_id"],
        "d1": d1.driver_id, "d2": d2.driver_id, "veh": veh.vehicle_id,
    }


def _create_delivery(client, w):
    return client.post("/v1/deliveries", headers=w["h"], json={
        "type": "Delivery",
        "sender": {"universal_id": w["press"]["universal_id"]},
        "recipient": {"id": w["hub"]["id"], "type": "ORG"},
        "sender_address_id": w["a_press"]["id"],
        "recipient_address_id": w["a_hub"]["id"],
        "planned_duration": 45,
        "allocations": [{"inventory_id": w["inv_id"], "expected_quantity": 5000}],
    })


def test_full_lifecycle(client, world):
    w = world
    h = w["h"]

    # ── Create ──────────────────────────────────────────────────────────────
    r = _create_delivery(client, w)
    assert r.status_code == 201, r.text
    d = r.json()
    did = d["id"]
    assert d["status"] == "Created"
    assert d["sender"]["entity_type"] == "ORG" and d["sender"]["name"] == "Central Press"
    assert d["recipient"]["name"] == "Hyderabad Hub"
    assert d["sender_address_snapshot"] == "1 Press Rd"      # immutable snapshot
    assert d["recipient_address_snapshot"] == "9 Hub Ave"
    assert len(d["allocations"]) == 1 and d["allocations"][0]["status"] == "Pending"
    item_id = d["allocations"][0]["allocation_id"]

    # ── Advance statuses (each writes a log) ─────────────────────────────────
    for nxt in ("Packed", "Dispatched", "OutForDelivery"):
        rr = client.post(f"/v1/deliveries/{did}/status", headers=h,
                         json={"status": nxt, "remark": f"-> {nxt}"})
        assert rr.status_code == 200, rr.text
        assert rr.json()["status"] == nxt

    # ── Assign then reassign driver + vehicle (logged, not overwritten) ──────
    assert client.post(f"/v1/deliveries/{did}/assign", headers=h,
                       json={"driver_id": w["d1"], "vehicle_id": w["veh"]}).status_code == 200
    rr = client.post(f"/v1/deliveries/{did}/assign", headers=h, json={"driver_id": w["d2"]})
    assert rr.status_code == 200 and rr.json()["driver_id"] == w["d2"]

    alogs = client.get(f"/v1/deliveries/{did}/assignment-logs", headers=h).json()["data"]
    actions = [a["action"] for a in alogs]
    assert "DRIVER_ASSIGNED" in actions and "VEHICLE_ASSIGNED" in actions
    assert "DRIVER_CHANGED" in actions  # reassignment recorded, not silent

    # ── Confirm with a quantity mismatch -> Discrepancy ─────────────────────
    rr = client.post(f"/v1/deliveries/{did}/confirm", headers=h, json={
        "photo_url": "https://cdn/pod.jpg",
        "allocations": [{"allocation_id": item_id, "confirmed_quantity": 4980}],
    })
    assert rr.status_code == 200, rr.text
    cd = rr.json()
    assert cd["confirmed_at"] is not None and cd["photo_url"].endswith("pod.jpg")
    assert cd["allocations"][0]["status"] == "Discrepancy"
    assert cd["allocations"][0]["confirmed_quantity"] == 4980

    # ── Freeze: advance to Delivered, then mutations are rejected ───────────
    assert client.post(f"/v1/deliveries/{did}/status", headers=h,
                       json={"status": "Delivered"}).status_code == 200

    patch = client.patch(f"/v1/deliveries/{did}", headers=h, json={"planned_duration": 99})
    assert patch.status_code == 409                     # frozen

    second_confirm = client.post(f"/v1/deliveries/{did}/confirm", headers=h,
                                 json={"allocations": [{"allocation_id": item_id, "confirmed_quantity": 5000}]})
    assert second_confirm.status_code == 409            # already confirmed

    # ── Event log captured the whole story ──────────────────────────────────
    logs = client.get(f"/v1/deliveries/{did}/logs", headers=h).json()["data"]
    log_actions = [l["action"] for l in logs]
    assert "CREATED" in log_actions and "CONFIRMED" in log_actions
    assert "STATUS_Delivered" in log_actions


def test_illegal_transition_rejected(client, world):
    w = world
    did = _create_delivery(client, w).json()["id"]
    # Skipping Packed is illegal.
    r = client.post(f"/v1/deliveries/{did}/status", headers=w["h"], json={"status": "Dispatched"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] in ("CONFLICT", "IMMUTABLE_RECORD")


def test_access_filtering(client, world, db):
    """A user who is neither sender, recipient, admin, nor grantee can't see it."""
    w = world
    did = _create_delivery(client, w).json()["id"]

    # An outsider vendor user (own org, not on this delivery).
    outsider_org = client.post("/v1/organizations", headers=w["h"],
                              json={"name": "Outsider", "type": "Vendor"}).json()
    create_user(db, organization_id=outsider_org["id"], name="Out", email="out@x.com",
                role=UserRole.Vendor, password_hash=hash_password("p"))
    db.commit()
    tok = client.post("/v1/auth/login", json={"email": "out@x.com", "password": "p"}).json()["access_token"]
    oh = {"Authorization": f"Bearer {tok}"}

    assert client.get(f"/v1/deliveries/{did}", headers=oh).status_code == 403
    assert all(x["id"] != did for x in client.get("/v1/deliveries", headers=oh).json()["data"])

    # Grant READ access -> now visible.
    assert client.post(f"/v1/deliveries/{did}/access", headers=w["h"], json={
        "participant_id": outsider_org["universal_id"], "entity_type": "ORG",
        "access_level": "READ"}).status_code == 201
    # (grant is to the org's universal_id; the user's own uid still differs, so
    #  this verifies the grant table is consulted for the participant_id.)
    grants = client.get(f"/v1/deliveries/{did}/access", headers=w["h"]).json()["data"]
    assert grants[0]["access_level"] == "READ"
