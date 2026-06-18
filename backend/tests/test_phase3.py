"""Phase 3 checkpoint: create + list + fetch org, user, address, product via API."""


def test_registry_crud_flow(client, admin):
    h = admin["headers"]

    # ── Organization ──────────────────────────────────────────────────────
    r = client.post(
        "/v1/organizations",
        headers=h,
        json={"name": "Hyderabad Hub", "type": "Hub", "email": "hub@x.com",
              "other_info": {"capacity": 100000, "city": "Hyderabad"}},
    )
    assert r.status_code == 201, r.text
    org = r.json()
    assert org["universal_id"] and org["id"]
    org_id = org["id"]

    assert client.get(f"/v1/organizations/{org_id}", headers=h).json()["name"] == "Hyderabad Hub"
    listing = client.get("/v1/organizations?type=Hub", headers=h).json()
    assert any(o["id"] == org_id for o in listing["data"])
    assert listing["pagination"]["total"] >= 1

    # ── User in that org ──────────────────────────────────────────────────
    r = client.post(
        "/v1/users",
        headers=h,
        json={"organization_id": org_id, "name": "Asha Rao", "email": "asha@x.com",
              "role": "HubOperator", "password": "asha-pass"},
    )
    assert r.status_code == 201, r.text
    user = r.json()
    assert "password_hash" not in user and "password" not in user
    user_id = user["id"]

    assert client.get(f"/v1/users/{user_id}", headers=h).json()["email"] == "asha@x.com"
    assert any(u["id"] == user_id for u in client.get("/v1/users", headers=h).json()["data"])

    # The created user can actually log in (password extension works).
    login = client.post("/v1/auth/login", json={"email": "asha@x.com", "password": "asha-pass"})
    assert login.status_code == 200, login.text
    assert "password_hash" not in login.json()["user"]

    # ── Address ───────────────────────────────────────────────────────────
    r = client.post("/v1/addresses", headers=h, json={"address": "12 Press Rd, Hyderabad"})
    assert r.status_code == 201, r.text
    addr_id = r.json()["id"]
    assert client.get(f"/v1/addresses/{addr_id}", headers=h).json()["address"].startswith("12 Press")
    assert any(a["id"] == addr_id for a in client.get("/v1/addresses", headers=h).json()["data"])

    # ── Product (created_by expands to the caller's ActorRef) ─────────────
    r = client.post(
        "/v1/products",
        headers=h,
        json={"name": "The Hindu - Morning - 18 Jun 2026", "stocks": 5000,
              "other_info": {"edition": "Morning", "language": "English"}},
    )
    assert r.status_code == 201, r.text
    product = r.json()
    pid = product["product_id"]
    assert product["created_by"]["entity_type"] == "USER"
    assert product["created_by"]["name"] == "Root Admin"

    assert client.get(f"/v1/products/{pid}", headers=h).json()["stocks"] == 5000
    assert any(p["product_id"] == pid for p in client.get("/v1/products", headers=h).json()["data"])

    # PATCH stock adjustment.
    r = client.patch(f"/v1/products/{pid}", headers=h, json={"stocks": 4800})
    assert r.status_code == 200 and r.json()["stocks"] == 4800


def test_non_admin_cannot_create_user_or_org(client, admin):
    h = admin["headers"]
    # Create a Vendor user, then act as them.
    org_id = client.post("/v1/organizations", headers=h,
                         json={"name": "V", "type": "Vendor"}).json()["id"]
    client.post("/v1/users", headers=h, json={
        "organization_id": org_id, "name": "Vinod", "email": "vinod@x.com",
        "role": "Vendor", "password": "v-pass"})
    tok = client.post("/v1/auth/login",
                      json={"email": "vinod@x.com", "password": "v-pass"}).json()["access_token"]
    vh = {"Authorization": f"Bearer {tok}"}

    assert client.post("/v1/organizations", headers=vh,
                       json={"name": "X", "type": "Hub"}).status_code == 403
    assert client.post("/v1/users", headers=vh, json={
        "organization_id": org_id, "name": "Y", "email": "y@x.com",
        "role": "Vendor"}).status_code == 403


def test_org_delete_409_with_dependents_then_soft_disable(client, admin):
    h = admin["headers"]
    org_id = client.post("/v1/organizations", headers=h,
                         json={"name": "HasUsers", "type": "Hub"}).json()["id"]
    client.post("/v1/users", headers=h, json={
        "organization_id": org_id, "name": "Dep", "email": "dep@x.com", "role": "HubOperator"})

    # Dependents exist → 409, never hard-deleted.
    r = client.delete(f"/v1/organizations/{org_id}", headers=h)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"

    # An org with no dependents soft-disables (204) and remains fetchable.
    empty_id = client.post("/v1/organizations", headers=h,
                           json={"name": "Empty", "type": "Vendor"}).json()["id"]
    assert client.delete(f"/v1/organizations/{empty_id}", headers=h).status_code == 204
    assert client.get(f"/v1/organizations/{empty_id}", headers=h).json()["is_active"] is False


def test_user_soft_disable(client, admin):
    h = admin["headers"]
    org_id = admin["org"].id
    uid = client.post("/v1/users", headers=h, json={
        "organization_id": org_id, "name": "Temp", "email": "temp@x.com",
        "role": "HubOperator", "password": "t-pass"}).json()["id"]

    assert client.delete(f"/v1/users/{uid}", headers=h).status_code == 204
    assert client.get(f"/v1/users/{uid}", headers=h).json()["is_active"] is False
    # Disabled users cannot log in.
    assert client.post("/v1/auth/login",
                       json={"email": "temp@x.com", "password": "t-pass"}).status_code == 401
