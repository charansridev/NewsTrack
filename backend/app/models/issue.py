from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import IssueStatus
from app.models.types import UUIDType, new_uuid


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Issue(Base):
    __tablename__ = "issues"

    id: Mapped[str] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_id: Mapped[str] = mapped_column(
        UUIDType, ForeignKey("deliveries.id"), nullable=False, index=True
    )
    # Polymorphic actor references -> universal_id.id.
    assigned_to: Mapped[str | None] = mapped_column(
        UUIDType, ForeignKey("universal_id.id"), nullable=True
    )
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[IssueStatus] = mapped_column(
        SAEnum(IssueStatus, name="issue_status"), nullable=False, default=IssueStatus.Open
    )
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str | None] = mapped_column(
        UUIDType, ForeignKey("universal_id.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, index=True
    )
    resolved_by: Mapped[str | None] = mapped_column(
        UUIDType, ForeignKey("universal_id.id"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
