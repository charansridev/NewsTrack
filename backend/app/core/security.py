"""Password hashing (bcrypt) and the two independent JWT systems.

User tokens and driver tokens are signed with separate secrets and carry
different claim sets. A token minted by one system fails verification on the
other — they are not interchangeable.
"""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import settings


# ── Password hashing ────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


# ── JWT helpers ───────────────────────────────────────────────────────────────
def _encode(claims: dict, secret: str, ttl_seconds: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {**claims, "iat": now, "exp": now + timedelta(seconds=ttl_seconds)}
    return jwt.encode(payload, secret, algorithm=settings.jwt_algorithm)


def _decode(token: str, secret: str) -> dict:
    return jwt.decode(token, secret, algorithms=[settings.jwt_algorithm])


# ── User token system ───────────────────────────────────────────────────────
def create_user_access_token(
    user_id: str, universal_id: str, organization_id: str, role: str
) -> str:
    return _encode(
        {
            "sub": user_id,
            "universal_id": universal_id,
            "organization_id": organization_id,
            "role": role,
            "token_use": "user_access",
        },
        settings.user_jwt_secret,
        settings.user_access_token_ttl,
    )


def create_user_refresh_token(user_id: str) -> str:
    return _encode(
        {"sub": user_id, "token_use": "user_refresh"},
        settings.user_jwt_secret,
        settings.user_refresh_token_ttl,
    )


def decode_user_token(token: str) -> dict:
    return _decode(token, settings.user_jwt_secret)


# ── Driver token system (separate secret) ─────────────────────────────────────
def create_driver_access_token(driver_id: str) -> str:
    return _encode(
        {"driver_id": driver_id, "driver": True, "token_use": "driver_access"},
        settings.driver_jwt_secret,
        settings.driver_access_token_ttl,
    )


def decode_driver_token(token: str) -> dict:
    return _decode(token, settings.driver_jwt_secret)
