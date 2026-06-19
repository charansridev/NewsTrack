from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import InventoryStatus
from app.models.types import JSONType, UUIDType, new_uuid


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ProductInventory(Base):
    """Authoritative available stock for one product within one organization.

    ``received_stock`` is cumulative inbound; ``current_stock`` is what's on hand.
    Stock changes flow through delivery dispatch/receipt or administrative
    adjustment — never via the metadata PATCH. (product_id, organization_id) is
    unique: one ledger row per product per org.
    """

    __tablename__ = "product_inventory"
    __table_args__ = (
        UniqueConstraint("product_id", "organization_id", name="uq_inventory_product_org"),
    )

    inventory_id: Mapped[str] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    product_id: Mapped[str] = mapped_column(
        UUIDType, ForeignKey("products.product_id"), nullable=False, index=True
    )
    organization_id: Mapped[str] = mapped_column(
        UUIDType, ForeignKey("organizations.id"), nullable=False, index=True
    )
    received_stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[InventoryStatus] = mapped_column(
        SAEnum(InventoryStatus, name="inventory_status"),
        nullable=False,
        default=InventoryStatus.Available,
    )
    other_info: Mapped[dict | None] = mapped_column(JSONType, nullable=True, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )
