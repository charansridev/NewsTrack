"""Phase 1 checkpoint: schema registers, circular-FK helper works, JWT round-trips."""

from sqlalchemy import select

from app.core.identity import create_organization, create_user
from app.core.security import (
    create_driver_access_token,
    create_user_access_token,
    decode_driver_token,
    decode_user_token,
    hash_password,
    verify_password,
)
from app.database import Base
from app.models.enums import EntityType, OrgType, UserRole
from app.models.universal_id import UniversalID


EXPECTED_TABLES = {
    "addresses", "deliveries", "delivery_access", "delivery_assignments_log",
    "delivery_items", "delivery_logs", "drivers", "issue_logs", "issues",
    "notifications", "organizations", "products", "universal_id", "users",
    "vehicles",
}


def test_all_tables_registered():
    assert EXPECTED_TABLES.issubset(set(Base.metadata.tables.keys()))


def test_circular_fk_safe_creation(db):
    org = create_organization(db, name="Hyderabad Hub", type=OrgType.Hub, email="hub@x.com")
    user = create_user(
        db,
        organization_id=org.id,
        name="Asha Rao",
        email="asha@x.com",
        role=UserRole.DistributionManager,
        password_hash=hash_password("secret"),
    )
    db.commit()

    # Each entity got a universal_id row pointing back at it.
    org_uid = db.get(UniversalID, org.universal_id)
    assert org_uid.entity_type == EntityType.ORG
    assert org_uid.entity_id == org.id

    user_uid = db.get(UniversalID, user.universal_id)
    assert user_uid.entity_type == EntityType.USER
    assert user_uid.entity_id == user.id

    # Reverse lookup via the unique (entity_type, entity_id) pair.
    found = db.execute(
        select(UniversalID).where(
            UniversalID.entity_type == EntityType.USER,
            UniversalID.entity_id == user.id,
        )
    ).scalar_one()
    assert found.id == user.universal_id


def test_password_hashing():
    h = hash_password("hunter2")
    assert h != "hunter2"
    assert verify_password("hunter2", h)
    assert not verify_password("wrong", h)
    assert not verify_password("x", None)


def test_two_jwt_systems_are_independent():
    user_tok = create_user_access_token("u1", "uid1", "org1", "Administrator")
    driver_tok = create_driver_access_token("d1")

    # Each decodes under its own secret.
    assert decode_user_token(user_tok)["sub"] == "u1"
    assert decode_driver_token(driver_tok)["driver_id"] == "d1"

    # A user token must NOT validate under the driver system, and vice versa.
    import jwt

    for bad in (lambda: decode_driver_token(user_tok), lambda: decode_user_token(driver_tok)):
        try:
            bad()
            assert False, "token cross-validated across systems"
        except jwt.PyJWTError:
            pass
