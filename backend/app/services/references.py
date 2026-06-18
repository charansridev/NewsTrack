"""Universal ID resolution and expansion — the heart of polymorphic actors.

``resolve_actor_input``  : (universal_id | {id,type})  -> canonical universal_id
``expand_reference``     : universal_id -> {universal_id, entity_type, entity_id, name}

Every actor field on write goes through resolution (so access checks run against
a canonical universal_id); every actor field on read goes through expansion.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BadRequest, NotFound
from app.models.enums import EntityType
from app.models.organization import Organization
from app.models.universal_id import UniversalID
from app.models.user import User
from app.schemas.references import ActorInput, ActorRef


def resolve_actor_input(
    db: Session,
    *,
    universal_id: str | None = None,
    id: str | None = None,
    type: EntityType | None = None,
) -> str:
    """Return the canonical universal_id for either input form.

    Raises BadRequest if neither form is supplied, NotFound if it doesn't exist.
    """
    if universal_id is not None:
        uid = db.get(UniversalID, universal_id)
        if uid is None:
            raise NotFound("Universal ID not found.")
        return uid.id

    if id is not None and type is not None:
        entity_type = type if isinstance(type, EntityType) else EntityType(type)
        uid = db.execute(
            select(UniversalID).where(
                UniversalID.entity_type == entity_type,
                UniversalID.entity_id == id,
            )
        ).scalar_one_or_none()
        if uid is None:
            raise NotFound("No universal_id for the given {id, type}.")
        return uid.id

    raise BadRequest(
        "Provide either 'universal_id' or both 'id' and 'type'.",
        details=[{"field": "universal_id", "message": "One of universal_id or {id,type} is required."}],
    )


def resolve_input_model(db: Session, actor: ActorInput) -> str:
    """Resolve an ``ActorInput`` payload to a canonical universal_id."""
    return resolve_actor_input(
        db, universal_id=actor.universal_id, id=actor.id, type=actor.type
    )


def _entity_name(db: Session, entity_type: EntityType, entity_id: str) -> str | None:
    if entity_type == EntityType.USER:
        user = db.get(User, entity_id)
        return user.name if user else None
    org = db.get(Organization, entity_id)
    return org.name if org else None


def expand_reference(db: Session, universal_id: str | None) -> ActorRef | None:
    """Expand a universal_id into a full ActorRef, or None if not set/unknown."""
    if universal_id is None:
        return None
    uid = db.get(UniversalID, universal_id)
    if uid is None:
        return None
    return ActorRef(
        universal_id=uid.id,
        entity_type=uid.entity_type,
        entity_id=uid.entity_id,
        name=_entity_name(db, uid.entity_type, uid.entity_id),
    )
