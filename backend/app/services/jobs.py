"""Background jobs: stale-status delay flag, missed-delivery flag, issue
escalation past deadline. Each is a plain function taking a Session (so tests
can drive them directly); ``scheduler_loop`` runs them periodically."""

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.delivery import Delivery, DeliveryItem
from app.models.enums import DeliveryItemStatus, DeliveryStatus, IssueLogAction, IssueStatus, NotificationSeverity
from app.models.issue import Issue
from app.models.logs import DeliveryLog, IssueLog
from app.realtime.events import (
    emit_delay_flagged,
    emit_issue_status_changed,
    emit_notification,
)
from app.services.notifications import notification_payload, notify_universal


def _now(now: datetime | None) -> datetime:
    return now or datetime.now(timezone.utc)


def _naive(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt


def _last_log_action(db: Session, delivery_id: str) -> str | None:
    return db.execute(
        select(DeliveryLog.action).where(DeliveryLog.delivery_id == delivery_id)
        .order_by(DeliveryLog.timestamp.desc()).limit(1)
    ).scalar_one_or_none()


def _last_log_time(db: Session, delivery_id: str) -> datetime | None:
    return db.execute(
        select(DeliveryLog.timestamp).where(DeliveryLog.delivery_id == delivery_id)
        .order_by(DeliveryLog.timestamp.desc()).limit(1)
    ).scalar_one_or_none()


def _notify_emit(db, *, universal_id, type, message, issue_id=None, severity=None):
    notifs = notify_universal(
        db, universal_id=universal_id, type=type, message=message,
        issue_id=issue_id, severity=severity,
    )
    db.flush()
    for n in notifs:
        emit_notification(notification_payload(n))


IN_TRANSIT = (DeliveryStatus.Dispatched, DeliveryStatus.OutForDelivery)


def flag_stale_deliveries(db: Session, threshold_min: int, now: datetime | None = None) -> list[str]:
    """Flag in-transit deliveries with no status update within the threshold."""
    cutoff = _naive(_now(now)) - timedelta(minutes=threshold_min)
    flagged = []
    rows = db.execute(select(Delivery).where(Delivery.status.in_(IN_TRANSIT))).scalars().all()
    for d in rows:
        last = _naive(_last_log_time(db, d.id)) or _naive(d.dispatched_at) or _naive(d.created_at)
        if last is None or last > cutoff:
            continue
        if _last_log_action(db, d.id) == "DELAY_FLAGGED":
            continue  # already flagged; awaits movement before re-flagging
        db.add(DeliveryLog(delivery_id=d.id, action="DELAY_FLAGGED",
                           remark=f"No update in {threshold_min} min."))
        emit_delay_flagged(d, threshold_min)
        for party in {d.sender_id, d.recipient_id}:
            _notify_emit(db, universal_id=party, type="DELIVERY_DELAYED",
                         message=f"Delivery {d.id} delayed (no update in {threshold_min} min).",
                         severity=NotificationSeverity.WARNING)
        flagged.append(d.id)
    db.commit()
    return flagged


def flag_missed_deliveries(db: Session, grace_min: int, now: datetime | None = None) -> list[str]:
    """Flag deliveries that blew past their planned window without delivering."""
    now_n = _naive(_now(now))
    missed = []
    rows = db.execute(
        select(Delivery).where(Delivery.status.in_(IN_TRANSIT))
    ).scalars().all()
    for d in rows:
        if d.dispatched_at is None or not d.planned_duration:
            continue
        deadline = _naive(d.dispatched_at) + timedelta(minutes=d.planned_duration + grace_min)
        if now_n <= deadline:
            continue
        if _last_log_action(db, d.id) == "MISSED_FLAGGED":
            continue
        db.add(DeliveryLog(delivery_id=d.id, action="MISSED_FLAGGED",
                           remark="Past planned delivery window."))
        # Mark still-pending items Missed.
        for item in db.execute(
            select(DeliveryItem).where(DeliveryItem.delivery_id == d.id)
        ).scalars().all():
            if item.status == DeliveryItemStatus.Pending:
                item.status = DeliveryItemStatus.Missed
        for party in {d.sender_id, d.recipient_id}:
            _notify_emit(db, universal_id=party, type="DELIVERY_MISSED",
                         message=f"Delivery {d.id} missed its delivery window.",
                         severity=NotificationSeverity.CRITICAL)
        missed.append(d.id)
    db.commit()
    return missed


def escalate_overdue_issues(db: Session, now: datetime | None = None) -> list[str]:
    """Escalate assigned issues whose deadline has passed."""
    now_n = _naive(_now(now))
    escalated = []
    rows = db.execute(
        select(Issue).where(Issue.status.notin_((IssueStatus.Resolved, IssueStatus.Escalated)))
    ).scalars().all()
    for issue in rows:
        if issue.deadline is None or _naive(issue.deadline) > now_n:
            continue
        issue.status = IssueStatus.Escalated
        db.add(IssueLog(issue_id=issue.id, action=IssueLogAction.ESCALATED.value,
                        remark="Auto-escalated: past deadline.", user_id=None))
        db.flush()
        emit_issue_status_changed(issue)
        for target in {issue.assigned_to, issue.created_by} - {None}:
            _notify_emit(db, universal_id=target, type="ISSUE_ESCALATED",
                         message=f"Issue '{issue.title}' auto-escalated (past deadline).",
                         issue_id=issue.id, severity=NotificationSeverity.WARNING)
        escalated.append(issue.id)
    db.commit()
    return escalated


def run_all_jobs(db: Session, now: datetime | None = None) -> dict:
    return {
        "delayed": flag_stale_deliveries(db, settings.stale_status_threshold_min, now),
        "missed": flag_missed_deliveries(db, settings.missed_delivery_grace_min, now),
        "escalated": escalate_overdue_issues(db, now),
    }


async def scheduler_loop() -> None:
    """Periodic sweep. Sleeps first so short-lived test processes never tick."""
    from starlette.concurrency import run_in_threadpool

    while True:
        await asyncio.sleep(settings.background_job_interval_sec)

        def _tick():
            db = SessionLocal()
            try:
                run_all_jobs(db)
            finally:
                db.close()

        try:
            await run_in_threadpool(_tick)
        except Exception:
            # Never let a sweep error kill the loop.
            pass
