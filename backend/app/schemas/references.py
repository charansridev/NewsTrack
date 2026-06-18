from pydantic import BaseModel, model_validator

from app.models.enums import EntityType


class ActorInput(BaseModel):
    """Polymorphic actor reference on write.

    Provide ``universal_id`` (preferred) OR ``id`` + ``type``. The server
    resolves ``{id, type}`` to a universal_id before any access check.
    """

    universal_id: str | None = None
    id: str | None = None
    type: EntityType | None = None

    @model_validator(mode="after")
    def _one_form_required(self):
        if self.universal_id is None and not (self.id is not None and self.type is not None):
            raise ValueError("Provide either 'universal_id' or both 'id' and 'type'.")
        return self


class ActorRef(BaseModel):
    """Expanded actor reference returned on read."""

    universal_id: str
    entity_type: EntityType
    entity_id: str
    name: str | None = None
