"""Issue serialization, access filtering, and the has_issue derivation."""

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.core.dependencies import Actor
from app.models.delivery import Delivery, DeliveryAccess
from app.models.enums import IssueStatus
from app.models.issue import Issue
from app.schemas.issue import IssueOut
from app.services.references import expand_reference


def issue_out(db: Session, issue: Issue) -> IssueOut:
    return IssueOut(
        id=issue.id,
        type=issue.type,
        title=issue.title,
        description=issue.description,
        delivery_id=issue.delivery_id,
        assigned_to=expand_reference(db, issue.assigned_to),
        assigned_at=issue.assigned_at,
        deadline=issue.deadline,
        status=issue.status,
        resolution_note=issue.resolution_note,
        created_by=expand_reference(db, issue.created_by),
        created_at=issue.created_at,
        resolved_by=expand_reference(db, issue.resolved_by),
        resolved_at=issue.resolved_at,
    )


def issue_access_filter(stmt: Select, actor: Actor) -> Select:
    """Restrict an Issue query to issues on deliveries the user may access."""
    if actor.is_admin:
        return stmt
    uid = actor.universal_id
    grant_ids = select(DeliveryAccess.delivery_id).where(DeliveryAccess.participant_id == uid)
    return stmt.join(Delivery, Delivery.id == Issue.delivery_id).where(
        or_(
            Delivery.sender_id == uid,
            Delivery.recipient_id == uid,
            Delivery.id.in_(grant_ids),
        )
    )


def recompute_has_issue(db: Session, delivery_id: str) -> None:
    """delivery.has_issue := any unresolved issue exists on the delivery."""
    db.flush()  # ensure pending status changes are visible to the COUNT
    open_count = db.execute(
        select(func.count())
        .select_from(Issue)
        .where(Issue.delivery_id == delivery_id, Issue.status != IssueStatus.Resolved)
    ).scalar_one()
    delivery = db.get(Delivery, delivery_id)
    if delivery is not None:
        delivery.has_issue = open_count > 0
