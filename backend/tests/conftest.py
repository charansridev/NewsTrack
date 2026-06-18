"""Shared test fixtures.

Tests run against an isolated in-memory SQLite database (via ``create_all``),
so they never touch the Postgres dev database. The portable column types
(UUID as CHAR, JSON instead of JSONB) make the schema SQLite-compatible.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.identity import create_organization, create_user
from app.core.security import create_user_access_token, hash_password
from app.database import Base, get_db
from app.models.enums import OrgType, UserRole
import app.models  # noqa: F401 — register all tables


@pytest.fixture()
def engine():
    eng = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(eng)
    try:
        yield eng
    finally:
        Base.metadata.drop_all(eng)


@pytest.fixture()
def Session(engine):
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@pytest.fixture()
def db(Session):
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(Session):
    from app.main import app

    def _override_get_db():
        s = Session()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def admin(db):
    """Bootstrap an Administrator + their org; return (user, token, headers)."""
    org = create_organization(db, name="NewsTrack HQ", type=OrgType.Hub, email="hq@x.com")
    user = create_user(
        db,
        organization_id=org.id,
        name="Root Admin",
        email="admin@x.com",
        role=UserRole.Administrator,
        password_hash=hash_password("admin-pass"),
    )
    db.commit()
    token = create_user_access_token(user.id, user.universal_id, org.id, user.role.value)
    headers = {"Authorization": f"Bearer {token}"}
    return {"org": org, "user": user, "token": token, "headers": headers}
