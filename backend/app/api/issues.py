from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import (
    Actor,
    check_delivery_access,
    get_current_actor,
)
from app.core.errors import BadRequest, Conflict, NotFound
from app.core.pagination import PageParams, paginate, page_params
from app.database import get_db
from app.models.enums import AccessLevel, IssueLogAction, IssueStatus, NotificationSeverity
from app.models.issue import Issue
from app.models.logs import IssueLog
from app.schemas.issue import (
    IssueAssignIn,
    IssueCommentIn,
    IssueCreate,
    IssueLogOut,
    IssueOut,
    IssueStatusIn,
)
from app.realtime.events import (
    emit_issue_raised,
    emit_issue_status_changed,
    emit_notification,
)
from app.services.issues import issue_access_filter, issue_out, recompute_has_issue
from app.services.notifications import notification_payload, notify_universal
from app.services.references import resolve_input_model

router = APIRouter(tags=["Issues"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _get_issue(db: Session, issue_id: str) -> Issue:
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise NotFound("Resource not found.")
    return issue


def _log(db: Session, issue_id: str, action: IssueLogAction, actor: Actor, remark: str | None):
    db.add(IssueLog(
        issue_id=issue_id, action=action.value, remark=remark, user_id=actor.actor_log_id
    ))


# ─────────────────────────────── list / raise ─────────────────────────────────
@router.get("/issues")
def list_issues(
    status: IssueStatus | None = Query(default=None),
    type: str | None = Query(default=None),
    delivery_id: str | None = Query(default=None),
    assigned_to: str | None = Query(default=None),
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    stmt = issue_access_filter(select(Issue), actor)
    if status is not None:
        stmt = stmt.where(Issue.status == status)
    if type is not None:
        stmt = stmt.where(Issue.type == type)
    if delivery_id is not None:
        stmt = stmt.where(Issue.delivery_id == delivery_id)
    if assigned_to is not None:
        stmt = stmt.where(Issue.assigned_to == assigned_to)
    stmt = stmt.order_by(Issue.created_at.desc())
    rows, pagination = paginate(db, stmt, params)
    return {"data": [issue_out(db, i) for i in rows], "pagination": pagination}


@router.post("/issues", response_model=IssueOut, status_code=201)
def raise_issue(
    body: IssueCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    # Must be able to see the delivery to raise an issue on it.
    delivery = check_delivery_access(db, actor, body.delivery_id, AccessLevel.READ)
    issue = Issue(
        type=body.type,
        title=body.title,
        description=body.description,
        delivery_id=delivery.id,
        status=IssueStatus.Open,
        created_by=actor.universal_id,  # None for a driver
    )
    db.add(issue)
    db.flush()
    delivery.has_issue = True
    delivery.issue_count = (delivery.issue_count or 0) + 1
    _log(db, issue.id, IssueLogAction.ISSUE_CREATED, actor, body.title)
    db.commit()
    db.refresh(issue)
    emit_issue_raised(issue)
    return issue_out(db, issue)


@router.get("/issues/{issue_id}", response_model=IssueOut)
def get_issue(
    issue_id: str,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    issue = _get_issue(db, issue_id)
    check_delivery_access(db, actor, issue.delivery_id, AccessLevel.READ)
    return issue_out(db, issue)


# ─────────────────────────────── assign / status ──────────────────────────────
@router.post("/issues/{issue_id}/assign", response_model=IssueOut)
def assign_issue(
    issue_id: str,
    body: IssueAssignIn,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    issue = _get_issue(db, issue_id)
    check_delivery_access(db, actor, issue.delivery_id, AccessLevel.WRITE)
    if issue.status == IssueStatus.Resolved:
        raise Conflict("Issue is resolved and cannot be reassigned.")

    assignee_uid = resolve_input_model(db, body.assigned_to)
    reassigning = issue.assigned_to is not None
    issue.assigned_to = assignee_uid
    issue.assigned_at = _utcnow()
    issue.deadline = body.deadline
    if issue.status == IssueStatus.Open:
        issue.status = IssueStatus.Assigned

    action = IssueLogAction.REASSIGNED if reassigning else IssueLogAction.ASSIGNED
    _log(db, issue.id, action, actor, body.remark)
    notifs = notify_universal(
        db, universal_id=assignee_uid, type="ISSUE_ASSIGNED",
        message=f"Issue '{issue.title}' assigned to you.",
        issue_id=issue.id, created_by=actor.universal_id, severity=NotificationSeverity.INFO,
    )
    db.flush()
    payloads = [notification_payload(n) for n in notifs]
    db.commit()
    db.refresh(issue)
    for p in payloads:
        emit_notification(p)
    return issue_out(db, issue)


@router.post("/issues/{issue_id}/status", response_model=IssueOut)
def change_issue_status(
    issue_id: str,
    body: IssueStatusIn,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    issue = _get_issue(db, issue_id)
    check_delivery_access(db, actor, issue.delivery_id, AccessLevel.WRITE)
    if issue.status == IssueStatus.Resolved:
        raise Conflict("Issue is already resolved (immutable).")

    new = body.status
    notifs = []

    if new == IssueStatus.Resolved:
        if not body.resolution_note:
            raise BadRequest(
                "resolution_note is required to resolve an issue.",
                details=[{"field": "resolution_note", "message": "Required when status=Resolved."}],
            )
        issue.status = new
        issue.resolution_note = body.resolution_note
        issue.resolved_by = actor.universal_id
        issue.resolved_at = _utcnow()
        _log(db, issue.id, IssueLogAction.RESOLVED, actor, body.remark or body.resolution_note)
        recompute_has_issue(db, issue.delivery_id)
        notifs += notify_universal(
            db, universal_id=issue.created_by, type="ISSUE_RESOLVED",
            message=f"Issue '{issue.title}' resolved.",
            issue_id=issue.id, created_by=actor.universal_id, severity=NotificationSeverity.INFO,
        )
    elif new == IssueStatus.Escalated:
        issue.status = new
        _log(db, issue.id, IssueLogAction.ESCALATED, actor, body.remark)
        for target in {issue.assigned_to, issue.created_by} - {None}:
            notifs += notify_universal(
                db, universal_id=target, type="ISSUE_ESCALATED",
                message=f"Issue '{issue.title}' escalated.",
                issue_id=issue.id, created_by=actor.universal_id,
                severity=NotificationSeverity.WARNING,
            )
    else:
        issue.status = new
        _log(db, issue.id, IssueLogAction.STATUS_CHANGED, actor, body.remark)

    db.flush()
    payloads = [notification_payload(n) for n in notifs]
    db.commit()
    db.refresh(issue)
    emit_issue_status_changed(issue)
    for p in payloads:
        emit_notification(p)
    return issue_out(db, issue)


# ─────────────────────────────── logs ─────────────────────────────────────────
@router.get("/issues/{issue_id}/logs")
def issue_logs(
    issue_id: str,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    issue = _get_issue(db, issue_id)
    check_delivery_access(db, actor, issue.delivery_id, AccessLevel.READ)
    rows = db.execute(
        select(IssueLog).where(IssueLog.issue_id == issue_id).order_by(IssueLog.created_at.asc())
    ).scalars().all()
    return {"data": [IssueLogOut.model_validate(r) for r in rows]}


@router.post("/issues/{issue_id}/logs", response_model=IssueLogOut, status_code=201)
def add_issue_comment(
    issue_id: str,
    body: IssueCommentIn,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    issue = _get_issue(db, issue_id)
    check_delivery_access(db, actor, issue.delivery_id, AccessLevel.READ)
    entry = IssueLog(
        issue_id=issue.id, action=IssueLogAction.COMMENT_ADDED.value,
        remark=body.remark, user_id=actor.actor_log_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return IssueLogOut.model_validate(entry)
