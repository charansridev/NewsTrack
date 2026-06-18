"""Typed emit helpers — the only place that knows event names + channel routing.

Channels: `transit_board` carries delivery lifecycle events; `alerts` carries
delays and issue events; notification.new is delivered to its target user.
"""

from datetime import datetime, timezone

from app.realtime.hub import hub


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def emit_status_changed(delivery) -> None:
    hub.publish("delivery.status_changed", {
        "delivery_id": delivery.id,
        "status": delivery.status.value,
        "driver_id": delivery.driver_id,
        "vehicle_id": delivery.vehicle_id,
        "at": _now(),
    }, channels=["transit_board"])


def emit_confirmed(delivery, has_discrepancy: bool) -> None:
    hub.publish("delivery.confirmed", {
        "delivery_id": delivery.id,
        "confirmed_by": delivery.confirmed_by,
        "at": _now(),
        "has_discrepancy": has_discrepancy,
    }, channels=["transit_board"])


def emit_assignment_changed(delivery, action: str) -> None:
    hub.publish("delivery.assignment_changed", {
        "delivery_id": delivery.id,
        "action": action,
        "driver_id": delivery.driver_id,
        "vehicle_id": delivery.vehicle_id,
        "at": _now(),
    }, channels=["transit_board"])


def emit_delay_flagged(delivery, threshold_min: int) -> None:
    hub.publish("delivery.delay_flagged", {
        "delivery_id": delivery.id,
        "vehicle_id": delivery.vehicle_id,
        "last_update_at": (delivery.dispatched_at or delivery.created_at).isoformat()
        if (delivery.dispatched_at or delivery.created_at) else None,
        "threshold_min": threshold_min,
    }, channels=["transit_board", "alerts"])


def emit_issue_raised(issue) -> None:
    hub.publish("issue.raised", {
        "issue_id": issue.id,
        "delivery_id": issue.delivery_id,
        "type": issue.type,
        "title": issue.title,
        "at": _now(),
    }, channels=["alerts"])


def emit_issue_status_changed(issue) -> None:
    hub.publish("issue.status_changed", {
        "issue_id": issue.id,
        "status": issue.status.value,
        "at": _now(),
    }, channels=["alerts"])


def emit_notification(payload: dict) -> None:
    hub.publish("notification.new", payload, user_id=payload.get("recipient_id"))
