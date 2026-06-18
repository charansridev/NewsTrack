from sqlalchemy import Enum as SAEnum
from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import EntityType
from app.models.types import UUIDType, new_uuid


class UniversalID(Base):
    """Polymorphic actor handle resolving to either a USER or an ORG.

    ``entity_id`` is intentionally NOT a DB-level foreign key: it is polymorphic
    (points at users OR organizations), so it cannot reference a single table.
    The (entity_type, entity_id) pair is unique — one universal id per entity.
    """

    __tablename__ = "universal_id"
    __table_args__ = (
        UniqueConstraint("entity_type", "entity_id", name="uq_universal_entity"),
    )

    id: Mapped[str] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    entity_type: Mapped[EntityType] = mapped_column(
        SAEnum(EntityType, name="entity_type"), nullable=False
    )
    entity_id: Mapped[str] = mapped_column(UUIDType, nullable=False, index=True)
