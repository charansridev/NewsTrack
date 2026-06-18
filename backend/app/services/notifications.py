"""Notification creation helpers.

A Notification always targets a single platform USER (recipient_id). When an
actor reference resolves to an ORG, every active user in that org is notified.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import EntityType, NotificationSeverity
from app.models.notification import Notification
from app.models.universal_id import UniversalID
from app.models.user import User


def create_notification(
    db: Session,
    *,
    recipient_user_id: str,
    type: str,
    message: str,
    issue_id: str | None = None,
    created_by: str | None = None,
    severity: NotificationSeverity | None = None,
) -> Notification:
    n = Notification(
        recipient_id=recipient_user_id,
        type=type,
        message=message,
        issue_id=issue_id,
        created_by=created_by,
        severity=severity,
    )
    db.add(n)
    return n


def notify_universal(
    db: Session,
    *,
    universal_id: str | None,
    type: str,
    message: str,
    issue_id: str | None = None,
    created_by: str | None = None,
    severity: NotificationSeverity | None = None,
) -> list[Notification]:
    """Notify the user(s) behind a universal_id (a USER, or every active user in
    an ORG). No-op if the reference is missing/unknown."""
    if universal_id is None:
        return []
    uid = db.get(UniversalID, universal_id)
    if uid is None:
        return []

    if uid.entity_type == EntityType.USER:
        recipients = [uid.entity_id]
    else:  # ORG → all active users in that org
        recipients = list(db.execute(
            select(User.id).where(User.organization_id == uid.entity_id, User.is_active.is_(True))
        ).scalars().all())

    out = []
    for rid in recipients:
        out.append(create_notification(
            db, recipient_user_id=rid, type=type, message=message,
            issue_id=issue_id, created_by=created_by, severity=severity,
        ))
    return out
