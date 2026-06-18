"""Shared column types.

UUIDs are stored as SQLAlchemy ``Uuid`` (native ``uuid`` on Postgres, CHAR(32)
elsewhere) but surfaced to Python as ``str`` for easy JSON handling.

JSON columns use ``JSONB`` on Postgres and fall back to ``JSON`` on other
backends (e.g. SQLite for a dry run), per the project's portability rule.
"""

import uuid

from sqlalchemy import JSON, Uuid
from sqlalchemy.dialects.postgresql import JSONB

# Portable UUID column: as_uuid=False → values round-trip as strings.
UUIDType = Uuid(as_uuid=False)

# JSONB on Postgres, JSON elsewhere.
JSONType = JSON().with_variant(JSONB, "postgresql")


def new_uuid() -> str:
    """Generate a fresh UUID as a string (used for client-side id pre-gen)."""
    return str(uuid.uuid4())
