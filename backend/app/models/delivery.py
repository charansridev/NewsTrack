from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import (
    AccessLevel,
    AllocationStatus,
    DeliveryStatus,
    DeliveryType,
    EntityType,
)
from app.models.types import UUIDType, new_uuid


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Delivery(Base):
    __tablename__ = "deliveries"

    id: Mapped[str] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    parent_delivery_id: Mapped[str | None] = mapped_column(
        UUIDType, ForeignKey("deliveries.id"), nullable=True
    )
    type: Mapped[DeliveryType] = mapped_column(
        SAEnum(DeliveryType, name="delivery_type"), nullable=False
    )
    # Polymorphic actor references -> universal_id.id.
    sender_id: Mapped[str] = mapped_column(
        UUIDType, ForeignKey("universal_id.id"), nullable=False, index=True
    )
    recipient_id: Mapped[str] = mapped_column(
        UUIDType, ForeignKey("universal_id.id"), nullable=False, index=True
    )
    driver_id: Mapped[str | None] = mapped_column(
        UUIDType, ForeignKey("drivers.driver_id"), nullable=True, index=True
    )
    vehicle_id: Mapped[str | None] = mapped_column(
        UUIDType, ForeignKey("vehicles.vehicle_id"), nullable=True
    )
    status: Mapped[DeliveryStatus] = mapped_column(
        SAEnum(DeliveryStatus, name="delivery_status"),
        nullable=False,
        default=DeliveryStatus.Created,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[str | None] = mapped_column(
        UUIDType, ForeignKey("universal_id.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, index=True
    )
    # Route analytics group on the address-id pair; snapshots are immutable text.
    sender_address_id: Mapped[str | None] = mapped_column(
        UUIDType, ForeignKey("addresses.id"), nullable=True, index=True
    )
    recipient_address_id: Mapped[str | None] = mapped_column(
        UUIDType, ForeignKey("addresses.id"), nullable=True, index=True
    )
    sender_address_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    recipient_address_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    planned_duration: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Stamped on the status transitions; the basis for actual-duration analytics.
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    confirmed_by: Mapped[str | None] = mapped_column(
        UUIDType, ForeignKey("universal_id.id"), nullable=True
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    has_issue: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    issue_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    allocations: Mapped[list["DeliveryAllocation"]] = relationship(
        back_populates="delivery", cascade="all, delete-orphan"
    )


class DeliveryAllocation(Base):
    """One line of a delivery: a quantity drawn from a specific sender inventory
    record (``inventory_id``) and moved to the recipient."""

    __tablename__ = "delivery_allocations"

    allocation_id: Mapped[str] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    inventory_id: Mapped[str] = mapped_column(
        UUIDType, ForeignKey("product_inventory.inventory_id"), nullable=False, index=True
    )
    delivery_id: Mapped[str] = mapped_column(
        UUIDType, ForeignKey("deliveries.id"), nullable=False, index=True
    )
    expected_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    confirmed_quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[AllocationStatus] = mapped_column(
        SAEnum(AllocationStatus, name="allocation_status"),
        nullable=False,
        default=AllocationStatus.Pending,
    )

    delivery: Mapped["Delivery"] = relationship(back_populates="allocations")


class DeliveryAccess(Base):
    """Additional (non-primary) access grants. Primary access — sender,
    recipient, assigned driver — is implicit and never stored here."""

    __tablename__ = "delivery_access"

    delivery_id: Mapped[str] = mapped_column(
        UUIDType, ForeignKey("deliveries.id"), primary_key=True
    )
    participant_id: Mapped[str] = mapped_column(
        UUIDType, primary_key=True
    )  # universal_id of grantee
    entity_type: Mapped[EntityType] = mapped_column(
        SAEnum(EntityType, name="access_entity_type"), nullable=False
    )
    access_level: Mapped[AccessLevel] = mapped_column(
        SAEnum(AccessLevel, name="access_level"), nullable=False
    )
