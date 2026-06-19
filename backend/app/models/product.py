from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.types import JSONType, UUIDType, new_uuid


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Product(Base):
    __tablename__ = "products"

    product_id: Mapped[str] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    # Owning organization — server-derived from the creator, never client-supplied.
    organization_id: Mapped[str | None] = mapped_column(
        UUIDType, ForeignKey("organizations.id"), nullable=True, index=True
    )
    # Polymorphic actor reference -> universal_id.id (USER or ORG).
    created_by: Mapped[str | None] = mapped_column(
        UUIDType, ForeignKey("universal_id.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sku: Mapped[str | None] = mapped_column(String(100), nullable=True)
    short_description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    other_info: Mapped[dict | None] = mapped_column(JSONType, nullable=True, default=dict)
