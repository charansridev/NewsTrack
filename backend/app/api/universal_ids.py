from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.enums import EntityType
from app.models.user import User
from app.schemas.references import ActorRef
from app.services.references import expand_reference, resolve_actor_input

router = APIRouter(tags=["Universal ID"])


@router.get("/universal-ids/resolve", response_model=ActorRef)
def resolve(
    universal_id: str | None = Query(default=None),
    id: str | None = Query(default=None),
    type: EntityType | None = Query(default=None),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Resolve a universal_id, or resolve {id,type} → universal_id, then expand.

    Exactly one of (universal_id) or (id + type) must be supplied.
    """
    canonical = resolve_actor_input(db, universal_id=universal_id, id=id, type=type)
    return expand_reference(db, canonical)
