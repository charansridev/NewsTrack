"""Phase 8 checkpoint: a driver status update arrives over the WebSocket in
well under 5s; the WS rejects an invalid token; background jobs flag stale and
missed deliveries and escalate overdue issues."""

from datetime import datetime, timedelta, timezone

import pytest

from app.models.delivery import Delivery
from app.models.enums import IssueStatus
from app.models.issue import Issue
from app.services.jobs import (
    escalate_overdue_issues,
    flag_missed_deliveries,
    flag_stale_deliveries,
)


@pytest.fixture()
def world(client, admin):
    h = admin["headers"]
    press = client.post("/v1/organizations", headers=h, json={"name": "Press", "type": "Press"}).json()
    hub = client.post("/v1/organizations", headers=h, json={"name": "Hub", "type": "Hub"}).json()
    product = client.post("/v1/products", headers=h, json={"name": "Daily", "stocks": 9000}).json()
    driver = client.post("/v1/drivers", headers=h, json={
        "driver_name": "Ravi", "mobile": "9700000001", "password": "ravi"}).json()
    did = client.post("/v1/deliveries", headers=h, json={
        "type": "Delivery",
        "sender": {"universal_id": press["universal_id"]},
        "recipient": {"universal_id": hub["universal_id"]},
        "items": [{"product_id": product["product_id"], "expected_quantity": 1000}],
    }).json()["id"]
    client.post(f"/v1/deliveries/{did}/assign", headers=h, json={"driver_id": driver["driver_id"]})
    return {"h": h, "press": press, "hub": hub, "did": did}


def test_ws_rejects_bad_token(client):
    with pytest.raises(Exception):
        with client.websocket_connect("/v1/realtime?token=garbage"):
            pass


def test_ws_receives_status_event(client, world, admin):
    w = world
    token = admin["token"]
    with client.websocket_connect(f"/v1/realtime?token={token}") as ws:
        ws.send_json({"action": "subscribe", "channels": ["transit_board", "alerts"]})
        ack = ws.receive_json()
        assert ack["event"] == "subscribed"

        # A status update on the manager's REST API...
        r = client.post(f"/v1/deliveries/{w['did']}/status", headers=w["h"],
                       json={"status": "Packed", "remark": "go"})
        assert r.status_code == 200

        # ...arrives over the socket (TestClient delivers synchronously, << 5s).
        evt = ws.receive_json()
        assert evt["event"] == "delivery.status_changed"
        assert evt["data"]["delivery_id"] == w["did"]
        assert evt["data"]["status"] == "Packed"


def test_job_flags_stale_delivery(client, world, db):
    w = world
    # Dispatch, then backdate the dispatch + log so it looks stale.
    client.post(f"/v1/deliveries/{w['did']}/status", headers=w["h"], json={"status": "Packed"})
    client.post(f"/v1/deliveries/{w['did']}/status", headers=w["h"], json={"status": "Dispatched"})

    from app.models.logs import DeliveryLog

    d = db.get(Delivery, w["did"])
    old = datetime.now(timezone.utc) - timedelta(hours=5)
    d.dispatched_at = old
    for lg in db.query(DeliveryLog).filter(DeliveryLog.delivery_id == d.id).all():
        lg.timestamp = old
    db.commit()

    flagged = flag_stale_deliveries(db, threshold_min=60)
    assert w["did"] in flagged
    # Idempotent: a second sweep doesn't re-flag (already flagged, awaiting movement).
    assert w["did"] not in flag_stale_deliveries(db, threshold_min=60)


def test_job_flags_missed_delivery(client, world, db):
    w = world
    client.post(f"/v1/deliveries/{w['did']}/status", headers=w["h"], json={"status": "Packed"})
    client.post(f"/v1/deliveries/{w['did']}/status", headers=w["h"], json={"status": "Dispatched"})
    d = db.get(Delivery, w["did"])
    d.planned_duration = 30
    d.dispatched_at = datetime.now(timezone.utc) - timedelta(hours=3)
    db.commit()

    missed = flag_missed_deliveries(db, grace_min=30)
    assert w["did"] in missed


def test_job_escalates_overdue_issue(client, world, db, admin):
    w = world
    iid = client.post("/v1/issues", headers=w["h"], json={
        "type": "Delay", "title": "late", "delivery_id": w["did"]}).json()["id"]
    client.post(f"/v1/issues/{iid}/assign", headers=w["h"], json={
        "assigned_to": {"universal_id": admin["user"].universal_id},
        "deadline": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()})

    escalated = escalate_overdue_issues(db)
    assert iid in escalated
    assert db.get(Issue, iid).status == IssueStatus.Escalated
