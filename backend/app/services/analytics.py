"""Derived analytics: route performance, daily summary, success rates, org KPIs.

Aggregation is done in Python after a single fetch. This keeps the math
identical across Postgres and SQLite (tests) and avoids dialect-specific date
SQL; for very large datasets these would be pushed into SQL.

All percentage/aggregate outputs are rounded to exactly 2 decimal places;
quantities stay exact integers.
"""

from datetime import date, datetime, time, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.delivery import Delivery
from app.models.enums import DeliveryStatus, EntityType, OrgType
from app.models.issue import Issue
from app.models.organization import Organization
from app.models.universal_id import UniversalID


def round2(value: float | None) -> float:
    return round(float(value or 0.0), 2)


def _naive(dt: datetime | None) -> datetime | None:
    """Normalise to naive UTC so aware (Postgres) and naive (SQLite) compare."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _actual_minutes(d: Delivery) -> float | None:
    start, end = _naive(d.dispatched_at), _naive(d.delivered_at)
    if start is None or end is None:
        return None
    return (end - start).total_seconds() / 60.0


def _in_range(dt: datetime | None, lo: datetime | None, hi: datetime | None) -> bool:
    n = _naive(dt)
    if n is None:
        return False
    if lo is not None and n < _naive(lo):
        return False
    if hi is not None and n > _naive(hi):
        return False
    return True


# ── Universal-id → org resolution (cached per call) ───────────────────────────
def _org_resolver(db: Session):
    cache: dict[str, Organization | None] = {}

    def resolve(universal_id: str | None) -> Organization | None:
        if universal_id is None:
            return None
        if universal_id not in cache:
            uid = db.get(UniversalID, universal_id)
            if uid is not None and uid.entity_type == EntityType.ORG:
                cache[universal_id] = db.get(Organization, uid.entity_id)
            else:
                cache[universal_id] = None
        return cache[universal_id]

    return resolve


# ── Route performance ─────────────────────────────────────────────────────────
def route_performance(db, sender_address_id=None, recipient_address_id=None,
                      from_=None, to=None) -> list[dict]:
    rows = db.execute(select(Delivery)).scalars().all()
    groups: dict[tuple[str, str], list[Delivery]] = {}
    for d in rows:
        if not d.sender_address_id or not d.recipient_address_id:
            continue
        if sender_address_id and d.sender_address_id != sender_address_id:
            continue
        if recipient_address_id and d.recipient_address_id != recipient_address_id:
            continue
        if (from_ or to) and not _in_range(d.created_at, from_, to):
            continue
        groups.setdefault((d.sender_address_id, d.recipient_address_id), []).append(d)

    out = []
    for (s_addr, r_addr), members in groups.items():
        durations = [m for m in (_actual_minutes(x) for x in members) if m is not None]
        on_time = sum(
            1 for m in members
            if (am := _actual_minutes(m)) is not None and m.planned_duration
            and am <= m.planned_duration
        )
        measured = sum(
            1 for m in members
            if _actual_minutes(m) is not None and m.planned_duration
        )
        out.append({
            "sender_address_id": s_addr,
            "recipient_address_id": r_addr,
            "total_runs": len(members),
            "min_duration": int(min(durations)) if durations else 0,
            "max_duration": int(max(durations)) if durations else 0,
            "avg_duration": round2(sum(durations) / len(durations)) if durations else 0.0,
            "on_time_pct": round2(100 * on_time / measured) if measured else 0.0,
            "delay_frequency": round2(100 * (measured - on_time) / measured) if measured else 0.0,
        })
    out.sort(key=lambda r: r["total_runs"], reverse=True)
    return out


# ── Daily summary ─────────────────────────────────────────────────────────────
def daily_summary(db, on_date: date) -> dict:
    lo = datetime.combine(on_date, time.min)
    hi = datetime.combine(on_date, time.max)
    created_today = [
        d for d in db.execute(select(Delivery)).scalars().all()
        if _in_range(d.created_at, lo, hi)
    ]
    dispatched = sum(1 for d in created_today if d.status in (
        DeliveryStatus.Dispatched, DeliveryStatus.OutForDelivery, DeliveryStatus.Delivered))
    delivered = sum(1 for d in created_today if d.status == DeliveryStatus.Delivered)
    pending = sum(1 for d in created_today if d.status in (
        DeliveryStatus.Created, DeliveryStatus.Packed))
    missed = sum(1 for d in created_today if d.status == DeliveryStatus.Terminated)
    delays = sum(
        1 for d in created_today
        if (am := _actual_minutes(d)) is not None and d.planned_duration and am > d.planned_duration
    )
    issues_raised = sum(
        1 for i in db.execute(select(Issue)).scalars().all() if _in_range(i.created_at, lo, hi)
    )
    return {
        "date": on_date.isoformat(),
        "bundles_created": len(created_today),
        "dispatched": dispatched,
        "delivered": delivered,
        "pending": pending,
        "missed_deliveries": missed,
        "delays": delays,
        "issues_raised": issues_raised,
    }


# ── Delivery success by route / vendor / hub ──────────────────────────────────
def delivery_success(db, group_by: str, from_=None, to=None) -> dict:
    resolve = _org_resolver(db)
    rows = [
        d for d in db.execute(select(Delivery)).scalars().all()
        if not (from_ or to) or _in_range(d.created_at, from_, to)
    ]

    def key_for(d: Delivery) -> str | None:
        if group_by == "route":
            if not d.sender_address_id or not d.recipient_address_id:
                return None
            return f"{d.sender_address_id} -> {d.recipient_address_id}"
        if group_by == "vendor":
            org = resolve(d.recipient_id)
            return org.name if org and org.type == OrgType.Vendor else None
        if group_by == "hub":
            for uid in (d.recipient_id, d.sender_id):
                org = resolve(uid)
                if org and org.type == OrgType.Hub:
                    return org.name
            return None
        return None

    groups: dict[str, list[Delivery]] = {}
    for d in rows:
        k = key_for(d)
        if k is not None:
            groups.setdefault(k, []).append(d)

    data = []
    for k, members in groups.items():
        total = len(members)
        delivered = sum(1 for m in members if m.status == DeliveryStatus.Delivered)
        missed = sum(1 for m in members if m.status == DeliveryStatus.Terminated)
        data.append({
            "key": k,
            "success_rate": round2(100 * delivered / total) if total else 0.0,
            "total": total,
            "delivered": delivered,
            "missed": missed,
        })
    data.sort(key=lambda r: r["total"], reverse=True)
    return {"group_by": group_by, "data": data}


# ── Organization performance ──────────────────────────────────────────────────
def org_performance(db, org_id: str, from_=None, to=None) -> dict:
    org = db.get(Organization, org_id)
    org_uid = None
    if org is not None:
        uid = db.execute(
            select(UniversalID).where(
                UniversalID.entity_type == EntityType.ORG, UniversalID.entity_id == org_id)
        ).scalar_one_or_none()
        org_uid = uid.id if uid else None

    members = []
    if org_uid is not None:
        for d in db.execute(select(Delivery)).scalars().all():
            if org_uid not in (d.sender_id, d.recipient_id):
                continue
            if (from_ or to) and not _in_range(d.created_at, from_, to):
                continue
            members.append(d)

    total = len(members)
    delivered = sum(1 for d in members if d.status == DeliveryStatus.Delivered)
    missed = sum(1 for d in members if d.status == DeliveryStatus.Terminated)

    confirm_times = []
    for d in members:
        c, start = _naive(d.confirmed_at), _naive(d.created_at)
        if c and start:
            confirm_times.append((c - start).total_seconds() / 60.0)

    issues_raised = 0
    member_ids = {d.id for d in members}
    if member_ids:
        issues_raised = sum(
            1 for i in db.execute(select(Issue)).scalars().all() if i.delivery_id in member_ids
        )

    return {
        "organization_id": org_id,
        "delivery_success_rate": round2(100 * delivered / total) if total else 0.0,
        "avg_confirmation_minutes": round2(sum(confirm_times) / len(confirm_times))
        if confirm_times else 0.0,
        "missed_deliveries": missed,
        "issues_raised": issues_raised,
    }
