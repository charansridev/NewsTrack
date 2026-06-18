"""Circular-FK-safe creation of entities that own a Universal ID.

``organizations.universal_id`` and ``users.universal_id`` are real FKs pointing
at ``universal_id.id``. The reverse pointer ``universal_id.entity_id`` is
polymorphic and therefore NOT a DB FK. To create an entity we must insert the
``universal_id`` row first (so the entity's FK is satisfiable), referencing the
entity id we pre-generate. This module centralises that dance.
"""

from sqlalchemy.orm import Session

from app.models.enums import EntityType
from app.models.organization import Organization
from app.models.types import new_uuid
from app.models.universal_id import UniversalID
from app.models.user import User


def _create_universal_id(db: Session, entity_type: EntityType, entity_id: str) -> UniversalID:
    uid = UniversalID(id=new_uuid(), entity_type=entity_type, entity_id=entity_id)
    db.add(uid)
    db.flush()  # ensure the universal_id row exists before the entity references it
    return uid


def create_organization(db: Session, **fields) -> Organization:
    """Create an Organization together with its Universal ID, in FK-safe order."""
    org_id = new_uuid()
    uid = _create_universal_id(db, EntityType.ORG, org_id)
    org = Organization(id=org_id, universal_id=uid.id, **fields)
    db.add(org)
    db.flush()
    return org


def create_user(db: Session, **fields) -> User:
    """Create a User together with its Universal ID, in FK-safe order."""
    user_id = new_uuid()
    uid = _create_universal_id(db, EntityType.USER, user_id)
    user = User(id=user_id, universal_id=uid.id, **fields)
    db.add(user)
    db.flush()
    return user
