from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.errors import NotFound
from app.core.pagination import PageParams, paginate, page_params
from app.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.issue import NotificationOut

router = APIRouter(tags=["Notifications"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _get_own(db: Session, notification_id: str, user: User) -> Notification:
    n = db.get(Notification, notification_id)
    if n is None or n.recipient_id != user.id:
        raise NotFound("Resource not found.")
    return n


@router.get("/notifications")
def list_notifications(
    is_read: bool | None = Query(default=None),
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    base = select(Notification).where(
        Notification.recipient_id == user.id, Notification.cleared_at.is_(None)
    )
    stmt = base
    if is_read is not None:
        stmt = stmt.where(Notification.is_read == is_read)
    stmt = stmt.order_by(Notification.created_at.desc())
    rows, pagination = paginate(db, stmt, params)

    unread_count = db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.recipient_id == user.id,
            Notification.cleared_at.is_(None),
            Notification.is_read.is_(False),
        )
    ).scalar_one()

    return {
        "data": [NotificationOut.model_validate(n) for n in rows],
        "unread_count": unread_count,
        "pagination": pagination,
    }


@router.post("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    n = _get_own(db, notification_id, user)
    n.is_read = True
    db.commit()
    db.refresh(n)
    return NotificationOut.model_validate(n)


@router.post("/notifications/{notification_id}/clear", response_model=NotificationOut)
def clear_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    n = _get_own(db, notification_id, user)
    if n.cleared_at is None:
        n.cleared_at = _utcnow()  # soft-clear; history preserved
    db.commit()
    db.refresh(n)
    return NotificationOut.model_validate(n)
