from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import AssignmentAction
from app.models.types import UUIDType, new_uuid


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DeliveryAssignmentLog(Base):
    """Immutable. One row per driver/vehicle assignment change."""

    __tablename__ = "delivery_assignments_log"

    id: Mapped[str] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    action: Mapped[AssignmentAction] = mapped_column(
        SAEnum(AssignmentAction, name="assignment_action"), nullable=False
    )
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    driver_id: Mapped[str | None] = mapped_column(UUIDType, nullable=True)
    vehicle_id: Mapped[str | None] = mapped_column(UUIDType, nullable=True)
    delivery_id: Mapped[str] = mapped_column(
        UUIDType, ForeignKey("deliveries.id"), nullable=False, index=True
    )
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)


class DeliveryLog(Base):
    """Immutable per-delivery event log."""

    __tablename__ = "delivery_logs"

    id: Mapped[str] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    delivery_id: Mapped[str] = mapped_column(
        UUIDType, ForeignKey("deliveries.id"), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Plain UUID (no FK): may be a user id OR a driver id, since drivers also
    # push status updates.
    user_id: Mapped[str | None] = mapped_column(UUIDType, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )


class IssueLog(Base):
    """Immutable issue audit entry."""

    __tablename__ = "issue_logs"

    id: Mapped[str] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    issue_id: Mapped[str] = mapped_column(
        UUIDType, ForeignKey("issues.id"), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_id: Mapped[str | None] = mapped_column(UUIDType, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
