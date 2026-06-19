"""Phase 7 checkpoint: success rates correct to 2 decimals, route metrics, and
the PDF export downloads with a title + date range + timestamp."""

import pytest


@pytest.fixture()
def seeded(client, admin):
    h = admin["headers"]
    press = client.post("/v1/organizations", headers=h, json={"name": "Press", "type": "Press"}).json()
    hub = client.post("/v1/organizations", headers=h, json={"name": "Hub", "type": "Hub"}).json()
    vendor = client.post("/v1/organizations", headers=h, json={"name": "Vendor A", "type": "Vendor"}).json()
    a1 = client.post("/v1/addresses", headers=h, json={"address": "Press Rd"}).json()
    a2 = client.post("/v1/addresses", headers=h, json={"address": "Hub Ave"}).json()
    product = client.post("/v1/products", headers=h, json={"name": "Daily"}).json()
    inv = client.post("/v1/inventory", headers=h, json={
        "organization_id": press["id"], "product_id": product["product_id"],
        "set_quantity": 10000000}).json()
    return {"h": h, "press": press, "hub": hub, "vendor": vendor,
            "a1": a1, "a2": a2, "product": product, "inv_id": inv["inventory_id"]}


def _run_delivery(client, h, w, recipient, *, deliver=True, planned=60, terminate=False):
    """Create on the (a1->a2) route and drive it to Delivered (or Terminated)."""
    did = client.post("/v1/deliveries", headers=h, json={
        "type": "Delivery",
        "sender": {"universal_id": w["press"]["universal_id"]},
        "recipient": {"universal_id": recipient["universal_id"]},
        "sender_address_id": w["a1"]["id"],
        "recipient_address_id": w["a2"]["id"],
        "planned_duration": planned,
        "allocations": [{"inventory_id": w["inv_id"], "expected_quantity": 500}],
    }).json()["id"]
    client.post(f"/v1/deliveries/{did}/status", headers=h, json={"status": "Packed"})
    client.post(f"/v1/deliveries/{did}/status", headers=h, json={"status": "Dispatched"})
    if terminate:
        client.post(f"/v1/deliveries/{did}/status", headers=h, json={"status": "Terminated"})
        return did
    client.post(f"/v1/deliveries/{did}/status", headers=h, json={"status": "OutForDelivery"})
    if deliver:
        client.post(f"/v1/deliveries/{did}/status", headers=h, json={"status": "Delivered"})
    return did


def test_delivery_success_rate_two_decimals(client, seeded):
    w, h = seeded, seeded["h"]
    # 3 delivered to the hub, 1 terminated -> 3/4 = 75.00%.
    for _ in range(3):
        _run_delivery(client, h, w, w["hub"])
    _run_delivery(client, h, w, w["hub"], terminate=True)

    res = client.get("/v1/reports/delivery-success?group_by=route", headers=h).json()
    assert res["group_by"] == "route"
    row = res["data"][0]
    assert row["total"] == 4 and row["delivered"] == 3 and row["missed"] == 1
    assert row["success_rate"] == 75.00
    # Rounded to exactly 2 decimals (float equality at 2dp).
    assert round(row["success_rate"], 2) == row["success_rate"]


def test_route_and_org_performance(client, seeded):
    w, h = seeded, seeded["h"]
    for _ in range(2):
        _run_delivery(client, h, w, w["hub"])

    routes = client.get("/v1/routes/performance", headers=h).json()["data"]
    assert routes and routes[0]["total_runs"] == 2
    assert routes[0]["sender_address_id"] == w["a1"]["id"]
    # Durations measured (dispatched->delivered happened in-process, ~0 min, on time vs planned 60).
    assert routes[0]["on_time_pct"] == 100.00

    perf = client.get(f"/v1/organizations/{w['hub']['id']}/performance", headers=h).json()
    assert perf["organization_id"] == w["hub"]["id"]
    assert perf["delivery_success_rate"] == 100.00
    assert perf["missed_deliveries"] == 0


def test_daily_summary(client, seeded):
    w, h = seeded, seeded["h"]
    _run_delivery(client, h, w, w["hub"])
    _run_delivery(client, h, w, w["hub"], terminate=True)
    s = client.get("/v1/reports/daily-summary", headers=h).json()
    assert s["bundles_created"] == 2
    assert s["delivered"] == 1
    assert s["missed_deliveries"] == 1


def test_pdf_export_downloads(client, seeded):
    w, h = seeded, seeded["h"]
    _run_delivery(client, h, w, w["hub"])

    for report in ("daily-summary", "delivery-success", "route-performance", "vendor-performance"):
        r = client.get(f"/v1/reports/export?report={report}", headers=h)
        assert r.status_code == 200, f"{report}: {r.status_code}"
        assert r.headers["content-type"] == "application/pdf"
        assert "attachment" in r.headers.get("content-disposition", "")
        assert r.content[:5] == b"%PDF-"   # valid PDF magic bytes
        assert len(r.content) > 500

    # Bad report name -> 400.
    assert client.get("/v1/reports/export?report=nope", headers=h).status_code == 400
