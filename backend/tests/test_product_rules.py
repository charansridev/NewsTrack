"""Product creation rules (products are catalog-only; stock lives in inventory).

- Only Administrators or members of a Press org may create products.
- organization_id / created_by / created_at are server-derived (un-forgeable).
Stock movement is covered in test_inventory.py.
"""

import pytest


def _login(client, email, pw):
    tok = client.post("/v1/auth/login", json={"email": email, "password": pw}).json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture()
def orgs_and_users(client, admin):
    h = admin["headers"]
    press = client.post("/v1/organizations", headers=h, json={"name": "Press", "type": "Press"}).json()
    vendor = client.post("/v1/organizations", headers=h, json={"name": "Vend", "type": "Vendor"}).json()
    hub = client.post("/v1/organizations", headers=h, json={"name": "Hub", "type": "Hub"}).json()

    # A user inside the Press org (role is irrelevant to the org-type allowance).
    client.post("/v1/users", headers=h, json={
        "organization_id": press["id"], "name": "Pat Press", "email": "press@x.com",
        "role": "HubOperator", "password": "p"})
    # A vendor user, a distribution manager, a hub operator.
    client.post("/v1/users", headers=h, json={
        "organization_id": vendor["id"], "name": "Val", "email": "vendor@x.com",
        "role": "Vendor", "password": "p"})
    client.post("/v1/users", headers=h, json={
        "organization_id": hub["id"], "name": "Dee", "email": "dm@x.com",
        "role": "DistributionManager", "password": "p"})
    client.post("/v1/users", headers=h, json={
        "organization_id": hub["id"], "name": "Hop", "email": "hub@x.com",
        "role": "HubOperator", "password": "p"})
    return {"h": h, "press": press, "vendor": vendor, "hub": hub}


def test_only_admin_or_press_can_create(client, admin, orgs_and_users):
    o = orgs_and_users
    # Administrator: allowed; org derived from the admin's own org.
    r = client.post("/v1/products", headers=o["h"], json={"name": "Admin Prod"})
    assert r.status_code == 201
    assert r.json()["organization_id"] == admin["org"].id
    assert r.json()["created_by"]["entity_type"] == "USER"

    # Press-org user: allowed; org is the Press.
    ph = _login(client, "press@x.com", "p")
    r = client.post("/v1/products", headers=ph, json={"name": "Press Prod", "sku": "PP-1"})
    assert r.status_code == 201
    assert r.json()["organization_id"] == o["press"]["id"]

    # Vendor / DistributionManager / HubOperator(non-Press): all 403.
    for email in ("vendor@x.com", "dm@x.com", "hub@x.com"):
        hh = _login(client, email, "p")
        rr = client.post("/v1/products", headers=hh, json={"name": "Nope"})
        assert rr.status_code == 403, f"{email} should be forbidden"
        assert rr.json()["error"]["code"] == "FORBIDDEN"


def test_ownership_cannot_be_forged(client, orgs_and_users):
    """Even if a caller stuffs organization_id/created_by into the body, the
    server ignores it and uses the caller's identity."""
    ph = _login(client, "press@x.com", "p")
    r = client.post("/v1/products", headers=ph, json={
        "name": "Forge", "organization_id": orgs_and_users["vendor"]["id"],
        "created_by": {"universal_id": "deadbeef"}})
    assert r.status_code == 201
    # Stayed the Press org, not the injected vendor org.
    assert r.json()["organization_id"] == orgs_and_users["press"]["id"]
