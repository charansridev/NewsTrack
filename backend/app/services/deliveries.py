"""Delivery serialization, lifecycle rules, and access-filtered queries."""

from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session

from app.core.dependencies import Actor
from app.core.errors import Conflict, ImmutableRecord
from app.models.delivery import Delivery, DeliveryAccess, DeliveryAllocation
from app.models.enums import (
    DELIVERY_FORWARD_ORDER,
    DELIVERY_TERMINAL_STATES,
    DeliveryStatus,
)
from app.schemas.delivery import AllocationOut, DeliveryOut
from app.services.references import expand_reference


# ── Serialization ─────────────────────────────────────────────────────────────
def allocation_out(alloc: DeliveryAllocation) -> AllocationOut:
    return AllocationOut.model_validate(alloc)


def delivery_out(db: Session, d: Delivery) -> DeliveryOut:
    """Serialize a Delivery, expanding all polymorphic actor refs and items."""
    return DeliveryOut(
        id=d.id,
        parent_delivery_id=d.parent_delivery_id,
        type=d.type,
        sender=expand_reference(db, d.sender_id),
        recipient=expand_reference(db, d.recipient_id),
        driver_id=d.driver_id,
        vehicle_id=d.vehicle_id,
        status=d.status,
        is_active=d.is_active,
        created_by=expand_reference(db, d.created_by),
        created_at=d.created_at,
        sender_address_id=d.sender_address_id,
        recipient_address_id=d.recipient_address_id,
        sender_address_snapshot=d.sender_address_snapshot,
        recipient_address_snapshot=d.recipient_address_snapshot,
        planned_duration=d.planned_duration,
        confirmed_by=expand_reference(db, d.confirmed_by),
        confirmed_at=d.confirmed_at,
        photo_url=d.photo_url,
        has_issue=d.has_issue,
        issue_count=d.issue_count,
        note=d.note,
        allocations=[allocation_out(a) for a in sorted(d.allocations, key=lambda x: x.allocation_id)],
    )


# ── Lifecycle rules ───────────────────────────────────────────────────────────
def is_frozen(d: Delivery) -> bool:
    return d.status in DELIVERY_TERMINAL_STATES


def ensure_mutable(d: Delivery) -> None:
    """Reject edits to a frozen (Delivered/Terminated) or confirmed delivery."""
    if is_frozen(d):
        raise ImmutableRecord("Delivery is frozen and cannot be modified.")
    if d.confirmed_at is not None:
        raise ImmutableRecord("Delivery is confirmed and cannot be modified.")


def validate_transition(current: DeliveryStatus, new: DeliveryStatus) -> None:
    """Enforce Created→Packed→Dispatched→OutForDelivery→Delivered (one step),
    or Terminated from any non-terminal state."""
    if current in DELIVERY_TERMINAL_STATES:
        raise ImmutableRecord("Delivery is frozen and cannot change status.")
    if new == DeliveryStatus.Terminated:
        return  # terminate allowed from any non-terminal state
    idx = DELIVERY_FORWARD_ORDER.index(current)
    expected_next = (
        DELIVERY_FORWARD_ORDER[idx + 1] if idx + 1 < len(DELIVERY_FORWARD_ORDER) else None
    )
    if new != expected_next:
        raise Conflict(
            f"Illegal status transition {current.value} -> {new.value}."
        )


# ── Access-filtered listing ───────────────────────────────────────────────────
def access_filter(stmt: Select, actor: Actor) -> Select:
    """Restrict a Delivery query to rows the user may see.

    Admin sees all. Otherwise: sender OR recipient OR an explicit grant.
    (Drivers use the dedicated /driver/me/deliveries endpoint.)
    """
    if actor.is_admin:
        return stmt
    uid = actor.universal_id
    grant_ids = select(DeliveryAccess.delivery_id).where(
        DeliveryAccess.participant_id == uid
    )
    return stmt.where(
        or_(
            Delivery.sender_id == uid,
            Delivery.recipient_id == uid,
            Delivery.id.in_(grant_ids),
        )
    )
