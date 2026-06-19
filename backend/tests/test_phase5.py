"""Phase 5 checkpoint: driver logs in, sees only assigned deliveries, and a
driver status update shows up on a manager's GET /deliveries."""

import pytest


@pytest.fixture()
def world(client, admin):
    h = admin["headers"]
    press = client.post("/v1/organizations", headers=h,
                       json={"name": "Press", "type": "Press"}).json()
    hub = client.post("/v1/organizations", headers=h,
                     json={"name": "Hub", "type": "Hub"}).json()
    product = client.post("/v1/products", headers=h, json={"name": "Daily"}).json()
    inv = client.post("/v1/inventory", headers=h, json={
        "organization_id": press["id"], "product_id": product["product_id"],
        "set_quantity": 1000000}).json()
    # Register two drivers via the API (with login passwords) + a vehicle.
    d1 = client.post("/v1/drivers", headers=h, json={
        "driver_name": "Ravi", "mobile": "9111111111", "password": "ravi-pass"}).json()
    d2 = client.post("/v1/drivers", headers=h, json={
        "driver_name": "Kumar", "mobile": "9222222222", "password": "kumar-pass"}).json()
    veh = client.post("/v1/vehicles", headers=h, json={
        "vehicle_number": "TS09XY1", "vehicle_type": "3W", "current_driver": d1["driver_id"]}).json()
    return {"h": h, "press": press, "hub": hub, "product": product,
            "inv_id": inv["inventory_id"], "d1": d1, "d2": d2, "veh": veh}


def _make_delivery(client, w, driver_id=None):
    did = client.post("/v1/deliveries", headers=w["h"], json={
        "type": "Delivery",
        "sender": {"universal_id": w["press"]["universal_id"]},
        "recipient": {"universal_id": w["hub"]["universal_id"]},
        "allocations": [{"inventory_id": w["inv_id"], "expected_quantity": 1000}],
    }).json()["id"]
    if driver_id:
        client.post(f"/v1/deliveries/{did}/assign", headers=w["h"], json={"driver_id": driver_id})
    return did


def test_driver_crud_and_vehicle(client, world):
    w = world
    # current_driver set on the vehicle.
    assert w["veh"]["current_driver"] == w["d1"]["driver_id"]
    # is_available filter.
    listing = client.get("/v1/drivers?is_available=true", headers=w["h"]).json()
    assert len(listing["data"]) == 2
    # PATCH availability.
    r = client.patch(f"/v1/drivers/{w['d1']['driver_id']}", headers=w["h"],
                     json={"is_available": False})
    assert r.status_code == 200 and r.json()["is_available"] is False
    # No password leak.
    assert "password_hash" not in r.json()


def test_driver_login_sees_only_assigned_and_updates_board(client, world):
    w = world
    mine = _make_delivery(client, w, driver_id=w["d1"]["driver_id"])
    other = _make_delivery(client, w, driver_id=w["d2"]["driver_id"])
    unassigned = _make_delivery(client, w)

    # Driver login (separate JWT system).
    login = client.post("/v1/driver/auth/login",
                        json={"mobile": "9111111111", "password": "ravi-pass"})
    assert login.status_code == 200, login.text
    dtok = login.json()["access_token"]
    dh = {"Authorization": f"Bearer {dtok}"}

    # Driver sees ONLY their assigned delivery.
    me = client.get("/v1/driver/me/deliveries", headers=dh).json()["data"]
    ids = {d["id"] for d in me}
    assert ids == {mine}
    assert other not in ids and unassigned not in ids

    # A user token cannot hit the driver-only endpoint.
    assert client.get("/v1/driver/me/deliveries", headers=w["h"]).status_code in (401, 403)

    # Driver advances status with the DRIVER token...
    up = client.post(f"/v1/deliveries/{mine}/status", headers=dh,
                     json={"status": "Packed", "remark": "picked up"})
    assert up.status_code == 200, up.text

    # ...and a MANAGER sees the new status on GET /deliveries.
    board = client.get("/v1/deliveries", headers=w["h"]).json()["data"]
    row = next(d for d in board if d["id"] == mine)
    assert row["status"] == "Packed"
    # The driver's update is attributed in the delivery log (driver id).
    logs = client.get(f"/v1/deliveries/{mine}/logs", headers=w["h"]).json()["data"]
    assert any(l["user_id"] == w["d1"]["driver_id"] and l["action"] == "STATUS_Packed"
               for l in logs)
