from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import NotificationSeverity
from app.models.types import UUIDType, new_uuid


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    severity: Mapped[NotificationSeverity | None] = mapped_column(
        SAEnum(NotificationSeverity, name="notification_severity"), nullable=True
    )
    # recipient_id is a plain user id (per contract, only created_by is an ActorRef).
    recipient_id: Mapped[str] = mapped_column(
        UUIDType, ForeignKey("users.id"), nullable=False, index=True
    )
    issue_id: Mapped[str | None] = mapped_column(
        UUIDType, ForeignKey("issues.id"), nullable=True
    )
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Nullable: system-generated notifications have no actor.
    created_by: Mapped[str | None] = mapped_column(
        UUIDType, ForeignKey("universal_id.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, index=True
    )
    cleared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
