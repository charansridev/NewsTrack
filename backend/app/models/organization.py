from sqlalchemy import Boolean, Enum as SAEnum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import OrgType
from app.models.types import JSONType, UUIDType, new_uuid


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    # Real FK (single direction): org -> its universal id. The reverse link
    # (universal_id.entity_id -> org.id) is polymorphic and not a DB FK, so no
    # circular constraint exists. The creation helper inserts the universal_id
    # row first, then the org.
    universal_id: Mapped[str] = mapped_column(
        UUIDType, ForeignKey("universal_id.id"), nullable=False, unique=True
    )
    parent_id: Mapped[str | None] = mapped_column(
        UUIDType, ForeignKey("organizations.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[OrgType] = mapped_column(SAEnum(OrgType, name="org_type"), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    other_info: Mapped[dict | None] = mapped_column(JSONType, nullable=True, default=dict)
    address_id: Mapped[str | None] = mapped_column(
        UUIDType, ForeignKey("addresses.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
