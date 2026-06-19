"""other_info / other_details strict-allowlist validation on create + update."""

import pytest

from app.metadata_schemas import validate_other_info
from app.core.errors import BadRequest


# ── unit-level: the validator itself ──────────────────────────────────────────
def test_validator_accepts_declared_keys():
    validate_other_info("organization", "Hub", {"capacity": 100, "city": "Hyd"})
    validate_other_info("organization", "Hub", None)   # empty is fine
    validate_other_info("organization", "Hub", {})


def test_validator_rejects_unknown_key():
    with pytest.raises(BadRequest):
        validate_other_info("organization", "Hub", {"banana": True})


def test_validator_rejects_wrong_type():
    with pytest.raises(BadRequest):
        validate_other_info("organization", "Hub", {"capacity": "lots"})  # want int


def test_validator_int_rejects_bool():
    with pytest.raises(BadRequest):
        validate_other_info("organization", "Hub", {"capacity": True})


def test_validator_per_discriminator():
    # 'department' is a User/DistributionManager key, not an Org key.
    with pytest.raises(BadRequest):
        validate_other_info("organization", "Hub", {"department": "Ops"})
    validate_other_info("user", "DistributionManager", {"department": "Ops", "shift": "AM"})


# ── API-level: org / product / vehicle ────────────────────────────────────────
def test_org_create_validates(client, admin):
    h = admin["headers"]
    ok = client.post("/v1/organizations", headers=h, json={
        "name": "H", "type": "Hub", "other_info": {"capacity": 100, "city": "Hyd"}})
    assert ok.status_code == 201

    bad = client.post("/v1/organizations", headers=h, json={
        "name": "H2", "type": "Hub", "other_info": {"capacity": 100, "nope": 1}})
    assert bad.status_code == 400
    assert bad.json()["error"]["code"] == "VALIDATION_ERROR"
    assert any(d["field"] == "nope" for d in bad.json()["error"]["details"])


def test_org_update_validates(client, admin):
    h = admin["headers"]
    oid = client.post("/v1/organizations", headers=h,
                     json={"name": "H", "type": "Hub"}).json()["id"]
    assert client.patch(f"/v1/organizations/{oid}", headers=h,
                       json={"other_info": {"city": "Secbad"}}).status_code == 200
    assert client.patch(f"/v1/organizations/{oid}", headers=h,
                       json={"other_info": {"bogus": 1}}).status_code == 400


def test_product_create_validates(client, admin):
    h = admin["headers"]
    ok = client.post("/v1/products", headers=h, json={
        "name": "Edition", "other_info": {"edition": "Morning", "bundle_id": "B1"}})
    assert ok.status_code == 201
    bad = client.post("/v1/products", headers=h, json={
        "name": "E2", "other_info": {"edition": "Morning", "weird": "x"}})
    assert bad.status_code == 400


def test_vehicle_create_validates(client, admin):
    h = admin["headers"]
    ok = client.post("/v1/vehicles", headers=h, json={
        "vehicle_number": "TS01AA1", "vehicle_type": "3W",
        "other_details": {"fuel_type": "Diesel", "gps_enabled": True}})
    assert ok.status_code == 201
    bad = client.post("/v1/vehicles", headers=h, json={
        "vehicle_number": "TS01AA2", "vehicle_type": "3W",
        "other_details": {"color": "red"}})
    assert bad.status_code == 400


def test_user_create_validates(client, admin):
    h = admin["headers"]
    org = admin["org"].id
    ok = client.post("/v1/users", headers=h, json={
        "organization_id": org, "name": "V", "email": "v1@x.com", "role": "Vendor",
        "other_info": {"coverage_area": "North", "subscription_count": 100}})
    assert ok.status_code == 201
    bad = client.post("/v1/users", headers=h, json={
        "organization_id": org, "name": "V2", "email": "v2@x.com", "role": "Vendor",
        "other_info": {"coverage_area": "North", "ghost": 1}})
    assert bad.status_code == 400
