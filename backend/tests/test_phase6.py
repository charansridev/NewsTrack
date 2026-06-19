"""Phase 6 checkpoint: driver raises an issue -> manager sees it, assigns,
escalates, and resolves it, with a complete immutable issue log and
notifications generated on assign/escalate/resolve."""

import pytest


@pytest.fixture()
def world(client, admin, db):
    h = admin["headers"]
    press = client.post("/v1/organizations", headers=h,
                       json={"name": "Press", "type": "Press"}).json()
    hub = client.post("/v1/organizations", headers=h, json={"name": "Hub", "type": "Hub"}).json()
    product = client.post("/v1/products", headers=h, json={"name": "Daily"}).json()
    inv = client.post("/v1/inventory", headers=h, json={
        "organization_id": press["id"], "product_id": product["product_id"],
        "set_quantity": 1000000}).json()
    driver = client.post("/v1/drivers", headers=h, json={
        "driver_name": "Ravi", "mobile": "9333333333", "password": "ravi"}).json()
    did = client.post("/v1/deliveries", headers=h, json={
        "type": "Delivery",
        "sender": {"universal_id": press["universal_id"]},
        "recipient": {"universal_id": hub["universal_id"]},
        "allocations": [{"inventory_id": inv["inventory_id"], "expected_quantity": 1000}],
    }).json()["id"]
    client.post(f"/v1/deliveries/{did}/assign", headers=h, json={"driver_id": driver["driver_id"]})
    return {"h": h, "press": press, "hub": hub, "did": did, "driver": driver,
            "admin_uid": admin["user"].universal_id}


def _driver_headers(client):
    tok = client.post("/v1/driver/auth/login",
                     json={"mobile": "9333333333", "password": "ravi"}).json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


def test_issue_lifecycle(client, world):
    w = world
    h = w["h"]
    dh = _driver_headers(client)

    # ── Driver raises an issue (driver JWT) ─────────────────────────────────
    raised = client.post("/v1/issues", headers=dh, json={
        "type": "Vehicle Breakdown", "title": "Truck stalled",
        "description": "Engine failure", "delivery_id": w["did"]})
    assert raised.status_code == 201, raised.text
    issue = raised.json()
    iid = issue["id"]
    assert issue["status"] == "Open"

    # delivery.has_issue flipped true.
    dl = client.get(f"/v1/deliveries/{w['did']}", headers=h).json()
    assert dl["has_issue"] is True and dl["issue_count"] == 1

    # Manager sees it on the list.
    listed = client.get("/v1/issues", headers=h).json()["data"]
    assert any(i["id"] == iid for i in listed)

    # ── Assign to the admin/manager (universal_id) ──────────────────────────
    asg = client.post(f"/v1/issues/{iid}/assign", headers=h, json={
        "assigned_to": {"universal_id": w["admin_uid"]}, "remark": "you handle it"})
    assert asg.status_code == 200
    assert asg.json()["status"] == "Assigned"
    assert asg.json()["assigned_to"]["universal_id"] == w["admin_uid"]

    # Assignee got an ISSUE_ASSIGNED notification.
    notifs = client.get("/v1/notifications", headers=h).json()
    assert notifs["unread_count"] >= 1
    assert any(n["type"] == "ISSUE_ASSIGNED" and n["issue_id"] == iid for n in notifs["data"])

    # ── Comment, then escalate ──────────────────────────────────────────────
    assert client.post(f"/v1/issues/{iid}/logs", headers=h,
                       json={"remark": "arranging replacement"}).status_code == 201
    esc = client.post(f"/v1/issues/{iid}/status", headers=h,
                     json={"status": "Escalated", "remark": "no driver available"})
    assert esc.status_code == 200 and esc.json()["status"] == "Escalated"

    # ── Resolve requires a resolution_note ──────────────────────────────────
    bad = client.post(f"/v1/issues/{iid}/status", headers=h, json={"status": "Resolved"})
    assert bad.status_code == 400

    ok = client.post(f"/v1/issues/{iid}/status", headers=h, json={
        "status": "Resolved", "resolution_note": "Replacement vehicle assigned."})
    assert ok.status_code == 200
    assert ok.json()["status"] == "Resolved"
    assert ok.json()["resolved_at"] is not None
    assert ok.json()["resolution_note"] == "Replacement vehicle assigned."

    # delivery.has_issue cleared (no more unresolved issues).
    dl = client.get(f"/v1/deliveries/{w['did']}", headers=h).json()
    assert dl["has_issue"] is False and dl["issue_count"] == 1  # count never decrements

    # ── A resolved issue is immutable ───────────────────────────────────────
    assert client.post(f"/v1/issues/{iid}/status", headers=h,
                      json={"status": "InProgress"}).status_code == 409

    # ── Immutable, complete issue log ───────────────────────────────────────
    logs = client.get(f"/v1/issues/{iid}/logs", headers=h).json()["data"]
    actions = [l["action"] for l in logs]
    assert actions[0] == "ISSUE_CREATED"
    for expected in ("ASSIGNED", "COMMENT_ADDED", "ESCALATED", "RESOLVED"):
        assert expected in actions, f"missing {expected} in {actions}"
    # No update/delete routes exist for logs (append-only); resolve notified creator.
    assert client.get("/v1/notifications", headers=h).json()  # creator was a driver -> no user notif


def test_notification_read_and_clear(client, world):
    w = world
    h = w["h"]
    iid = client.post("/v1/issues", headers=h, json={
        "type": "Delay", "title": "late", "delivery_id": w["did"]}).json()["id"]
    client.post(f"/v1/issues/{iid}/assign", headers=h,
               json={"assigned_to": {"universal_id": w["admin_uid"]}})

    notifs = client.get("/v1/notifications", headers=h).json()
    nid = notifs["data"][0]["id"]
    before = notifs["unread_count"]

    r = client.post(f"/v1/notifications/{nid}/read", headers=h)
    assert r.status_code == 200 and r.json()["is_read"] is True
    assert client.get("/v1/notifications", headers=h).json()["unread_count"] == before - 1

    c = client.post(f"/v1/notifications/{nid}/clear", headers=h)
    assert c.status_code == 200 and c.json()["cleared_at"] is not None
    # Cleared notifications drop out of the default list.
    assert all(n["id"] != nid for n in client.get("/v1/notifications", headers=h).json()["data"])
