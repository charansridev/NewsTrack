from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import (
    Actor,
    check_delivery_access,
    get_current_actor,
    get_current_user,
    require_roles,
)
from app.core.errors import BadRequest, Conflict, NotFound
from app.core.pagination import PageParams, apply_sort, paginate, page_params
from app.database import get_db
from app.models.address import Address
from app.models.delivery import Delivery, DeliveryAccess, DeliveryAllocation
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.models.enums import (
    AccessLevel,
    AllocationStatus,
    AssignmentAction,
    DeliveryStatus,
    UserRole,
)
from app.models.inventory import ProductInventory
from app.models.logs import DeliveryAssignmentLog, DeliveryLog
from app.models.user import User
from app.schemas.delivery import (
    AllocationAdd,
    AllocationOut,
    AllocationUpdate,
    AssignIn,
    ConfirmIn,
    DeliveryAccessIn,
    DeliveryAccessOut,
    DeliveryAssignmentLogOut,
    DeliveryCreate,
    DeliveryLogOut,
    DeliveryOut,
    DeliveryUpdate,
    StatusChangeIn,
)
from app.services.deliveries import (
    access_filter,
    allocation_out,
    delivery_out,
    ensure_mutable,
    is_frozen,
    validate_transition,
)
from app.realtime.events import (
    emit_assignment_changed,
    emit_confirmed,
    emit_status_changed,
)
from app.services.inventory import (
    credit_receipt,
    debit,
    get_by_id,
    org_id_for_universal,
)
from app.services.references import resolve_input_model

router = APIRouter(tags=["Deliveries"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _log(db: Session, delivery_id: str, action: str, actor: Actor, remark: str | None = None):
    db.add(DeliveryLog(
        delivery_id=delivery_id, action=action, remark=remark, user_id=actor.actor_log_id
    ))


# ─────────────────────────────── core CRUD ────────────────────────────────────
@router.post("/deliveries", response_model=DeliveryOut, status_code=201)
def create_delivery(
    body: DeliveryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sender_uid = resolve_input_model(db, body.sender)
    recipient_uid = resolve_input_model(db, body.recipient)

    sender_snap = recipient_snap = None
    if body.sender_address_id:
        addr = db.get(Address, body.sender_address_id)
        if addr is None:
            raise BadRequest("sender_address_id does not reference an existing address.")
        sender_snap = addr.address
    if body.recipient_address_id:
        addr = db.get(Address, body.recipient_address_id)
        if addr is None:
            raise BadRequest("recipient_address_id does not reference an existing address.")
        recipient_snap = addr.address

    delivery = Delivery(
        type=body.type,
        sender_id=sender_uid,
        recipient_id=recipient_uid,
        parent_delivery_id=body.parent_delivery_id,
        status=DeliveryStatus.Created,
        is_active=True,
        created_by=user.universal_id,
        sender_address_id=body.sender_address_id,
        recipient_address_id=body.recipient_address_id,
        sender_address_snapshot=sender_snap,
        recipient_address_snapshot=recipient_snap,
        planned_duration=body.planned_duration,
        note=body.note,
    )
    db.add(delivery)
    db.flush()

    # Inventory gate: each allocation must draw from an inventory record that
    # belongs to the SENDER org and holds enough current_stock.
    sender_org = org_id_for_universal(db, sender_uid)

    if user.role != UserRole.Administrator:
        if sender_org != user.organization_id:
            raise Conflict("You can only create deliveries from your own organization.")

    shortfalls = []
    for alloc in body.allocations:
        inv = get_by_id(db, alloc.inventory_id)
        if inv is None:
            raise BadRequest(f"inventory_id {alloc.inventory_id} does not exist.")
        if sender_org is not None and inv.organization_id != sender_org:
            shortfalls.append({
                "field": alloc.inventory_id,
                "message": "Inventory record does not belong to the sender organization.",
            })
        elif inv.current_stock < alloc.expected_quantity:
            shortfalls.append({
                "field": alloc.inventory_id,
                "message": f"Insufficient stock: have {inv.current_stock}, "
                           f"need {alloc.expected_quantity}.",
            })
        db.add(DeliveryAllocation(
            delivery_id=delivery.id,
            inventory_id=alloc.inventory_id,
            expected_quantity=alloc.expected_quantity,
            status=AllocationStatus.Pending,
        ))
    if shortfalls:
        raise BadRequest("Sender inventory cannot cover these allocations.",
                         details=shortfalls)
    _log(db, delivery.id, "CREATED", Actor(kind="user", user=user), "Delivery created")
    db.commit()
    db.refresh(delivery)
    return delivery_out(db, delivery)


@router.get("/deliveries")
def list_deliveries(
    status: DeliveryStatus | None = Query(default=None),
    sender_id: str | None = Query(default=None),
    recipient_id: str | None = Query(default=None),
    driver_id: str | None = Query(default=None),
    vehicle_id: str | None = Query(default=None),
    parent_delivery_id: str | None = Query(default=None),
    has_issue: bool | None = Query(default=None),
    sender_address_id: str | None = Query(default=None),
    recipient_address_id: str | None = Query(default=None),
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
    sort: str | None = Query(default=None),
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    actor = Actor(kind="user", user=user)
    stmt = access_filter(select(Delivery), actor)
    if status is not None:
        stmt = stmt.where(Delivery.status == status)
    if sender_id is not None:
        stmt = stmt.where(Delivery.sender_id == sender_id)
    if recipient_id is not None:
        stmt = stmt.where(Delivery.recipient_id == recipient_id)
    if driver_id is not None:
        stmt = stmt.where(Delivery.driver_id == driver_id)
    if vehicle_id is not None:
        stmt = stmt.where(Delivery.vehicle_id == vehicle_id)
    if parent_delivery_id is not None:
        stmt = stmt.where(Delivery.parent_delivery_id == parent_delivery_id)
    if has_issue is not None:
        stmt = stmt.where(Delivery.has_issue == has_issue)
    if sender_address_id is not None:
        stmt = stmt.where(Delivery.sender_address_id == sender_address_id)
    if recipient_address_id is not None:
        stmt = stmt.where(Delivery.recipient_address_id == recipient_address_id)
    if from_ is not None:
        stmt = stmt.where(Delivery.created_at >= from_)
    if to is not None:
        stmt = stmt.where(Delivery.created_at <= to)
    stmt = apply_sort(stmt, Delivery, sort, default_col="created_at")
    rows, pagination = paginate(db, stmt, params)
    return {"data": [delivery_out(db, d) for d in rows], "pagination": pagination}


@router.get("/deliveries/{delivery_id}", response_model=DeliveryOut)
def get_delivery(
    delivery_id: str,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    d = check_delivery_access(db, actor, delivery_id, AccessLevel.READ)
    return delivery_out(db, d)


@router.patch("/deliveries/{delivery_id}", response_model=DeliveryOut)
def update_delivery(
    delivery_id: str,
    body: DeliveryUpdate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    d = check_delivery_access(db, actor, delivery_id, AccessLevel.WRITE)
    ensure_mutable(d)
    data = body.model_dump(exclude_unset=True)
    # Re-snapshot if an address id changes.
    if "sender_address_id" in data and data["sender_address_id"]:
        addr = db.get(Address, data["sender_address_id"])
        if addr is None:
            raise BadRequest("sender_address_id does not reference an existing address.")
        d.sender_address_snapshot = addr.address
    if "recipient_address_id" in data and data["recipient_address_id"]:
        addr = db.get(Address, data["recipient_address_id"])
        if addr is None:
            raise BadRequest("recipient_address_id does not reference an existing address.")
        d.recipient_address_snapshot = addr.address
    for field, value in data.items():
        setattr(d, field, value)
    db.commit()
    db.refresh(d)
    return delivery_out(db, d)


# ─────────────────────────────── lifecycle actions ────────────────────────────
@router.post("/deliveries/{delivery_id}/status", response_model=DeliveryOut)
def change_status(
    delivery_id: str,
    body: StatusChangeIn,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    d = check_delivery_access(db, actor, delivery_id, AccessLevel.WRITE)
    validate_transition(d.status, body.status)
    now = _utcnow()

    if body.status == DeliveryStatus.Dispatched:
        # Validate sender stock is still sufficient, then debit each allocation.
        for alloc in d.allocations:
            inv = get_by_id(db, alloc.inventory_id)
            if inv is None or inv.current_stock < alloc.expected_quantity:
                have = inv.current_stock if inv else 0
                raise Conflict(
                    f"Insufficient inventory to dispatch allocation {alloc.allocation_id}: "
                    f"have {have}, need {alloc.expected_quantity}."
                )
        for alloc in d.allocations:
            debit(db, alloc.inventory_id, alloc.expected_quantity)
        d.dispatched_at = now

    if body.status == DeliveryStatus.Delivered:
        # Credit the recipient org's inventory for each allocation's product.
        recipient_org = org_id_for_universal(db, d.recipient_id)
        if recipient_org is not None:
            for alloc in d.allocations:
                inv = get_by_id(db, alloc.inventory_id)
                if inv is not None:
                    credit_receipt(db, recipient_org, inv.product_id, alloc.expected_quantity)
        d.delivered_at = now

    d.status = body.status
    if body.status in (DeliveryStatus.Delivered, DeliveryStatus.Terminated):
        d.is_active = False
    _log(db, d.id, f"STATUS_{body.status.value}", actor, body.remark)
    db.commit()
    db.refresh(d)
    emit_status_changed(d)
    return delivery_out(db, d)


@router.post("/deliveries/{delivery_id}/assign", response_model=DeliveryOut)
def assign_delivery(
    delivery_id: str,
    body: AssignIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    actor = Actor(kind="user", user=user)
    d = check_delivery_access(db, actor, delivery_id, AccessLevel.WRITE)
    if is_frozen(d):
        raise Conflict("Delivery is frozen and cannot be modified.")

    fields = body.model_dump(exclude_unset=True)
    emitted_actions: list[AssignmentAction] = []

    # ── Driver assignment (logged, never silently overwritten) ──────────────
    if "driver_id" in fields:
        new_driver = fields["driver_id"]
        old_driver = d.driver_id
        if new_driver is not None:
            driver = db.get(Driver, new_driver)
            if driver is None:
                raise BadRequest("driver_id does not reference an existing driver.")
            if not driver.is_available and new_driver != old_driver:
                raise Conflict("Driver is not available for assignment.")
        if new_driver != old_driver:
            if old_driver is None and new_driver is not None:
                action = AssignmentAction.DRIVER_ASSIGNED
            elif new_driver is None:
                action = AssignmentAction.DRIVER_REMOVED
            else:
                action = AssignmentAction.DRIVER_CHANGED
            
            if old_driver is not None:
                old_d_obj = db.get(Driver, old_driver)
                if old_d_obj:
                    old_d_obj.is_available = True
            if new_driver is not None:
                driver.is_available = False

            d.driver_id = new_driver
            db.add(DeliveryAssignmentLog(
                action=action, entity_type="DRIVER", delivery_id=d.id,
                driver_id=new_driver, vehicle_id=d.vehicle_id, remark=body.remark,
            ))
            emitted_actions.append(action)

    # ── Vehicle assignment ──────────────────────────────────────────────────
    if "vehicle_id" in fields:
        new_vehicle = fields["vehicle_id"]
        old_vehicle = d.vehicle_id
        if new_vehicle is not None:
            vehicle = db.get(Vehicle, new_vehicle)
            if vehicle is None:
                raise BadRequest("vehicle_id does not reference an existing vehicle.")
            if not vehicle.is_available and new_vehicle != old_vehicle:
                raise Conflict("Vehicle is not available for assignment.")
        if new_vehicle != old_vehicle:
            if old_vehicle is None and new_vehicle is not None:
                action = AssignmentAction.VEHICLE_ASSIGNED
            elif new_vehicle is None:
                action = AssignmentAction.VEHICLE_REMOVED
            else:
                action = AssignmentAction.VEHICLE_CHANGED
            
            if old_vehicle is not None:
                old_v_obj = db.get(Vehicle, old_vehicle)
                if old_v_obj:
                    old_v_obj.is_available = True
            if new_vehicle is not None:
                vehicle.is_available = False

            d.vehicle_id = new_vehicle
            db.add(DeliveryAssignmentLog(
                action=action, entity_type="VEHICLE", delivery_id=d.id,
                driver_id=d.driver_id, vehicle_id=new_vehicle, remark=body.remark,
            ))
            emitted_actions.append(action)

    db.commit()
    db.refresh(d)
    for act in emitted_actions:
        emit_assignment_changed(d, act.value)
    return delivery_out(db, d)


@router.post("/deliveries/{delivery_id}/confirm", response_model=DeliveryOut)
def confirm_delivery(
    delivery_id: str,
    body: ConfirmIn,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    d = check_delivery_access(db, actor, delivery_id, AccessLevel.CONFIRM)
    if d.confirmed_at is not None:
        raise Conflict("Delivery already confirmed (immutable).")
    if d.status == DeliveryStatus.Terminated:
        raise Conflict("Delivery is terminated and cannot be confirmed.")

    allocs_by_id = {a.allocation_id: a for a in d.allocations}
    has_discrepancy = False
    for ca in body.allocations:
        alloc = allocs_by_id.get(ca.allocation_id)
        if alloc is None:
            raise BadRequest(f"allocation_id {ca.allocation_id} is not on this delivery.")
        alloc.confirmed_quantity = ca.confirmed_quantity
        if ca.confirmed_quantity == alloc.expected_quantity:
            alloc.status = AllocationStatus.Confirmed
        else:
            alloc.status = AllocationStatus.Discrepancy
            has_discrepancy = True

    d.confirmed_by = actor.universal_id  # None for a driver confirmation
    d.confirmed_at = _utcnow()
    if body.photo_url is not None:
        d.photo_url = body.photo_url
    _log(db, d.id, "CONFIRMED",
         actor, "Discrepancy detected" if has_discrepancy else "Confirmed without discrepancy")
    db.commit()
    db.refresh(d)
    emit_confirmed(d, has_discrepancy)
    return delivery_out(db, d)


# ─────────────────────────────── manifest / allocations ───────────────────────
@router.get("/deliveries/{delivery_id}/manifest")
def get_manifest(
    delivery_id: str,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    d = check_delivery_access(db, actor, delivery_id, AccessLevel.READ)
    return {
        "delivery_id": d.id,
        "vehicle_id": d.vehicle_id,
        "allocations": [allocation_out(a) for a in sorted(d.allocations, key=lambda x: x.allocation_id)],
    }


@router.get("/deliveries/{delivery_id}/allocations")
def list_allocations(
    delivery_id: str,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    d = check_delivery_access(db, actor, delivery_id, AccessLevel.READ)
    return {"data": [allocation_out(a) for a in sorted(d.allocations, key=lambda x: x.allocation_id)]}


@router.post("/deliveries/{delivery_id}/allocations", response_model=AllocationOut, status_code=201)
def add_allocation(
    delivery_id: str,
    body: AllocationAdd,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    d = check_delivery_access(db, actor, delivery_id, AccessLevel.WRITE)
    ensure_mutable(d)
    inv = get_by_id(db, body.inventory_id)
    if inv is None:
        raise BadRequest("inventory_id does not exist.")
    sender_org = org_id_for_universal(db, d.sender_id)
    if sender_org is not None and inv.organization_id != sender_org:
        raise BadRequest("Inventory record does not belong to the sender organization.")
    alloc = DeliveryAllocation(
        delivery_id=d.id,
        inventory_id=body.inventory_id,
        expected_quantity=body.expected_quantity,
        status=AllocationStatus.Pending,
    )
    db.add(alloc)
    db.commit()
    db.refresh(alloc)
    return allocation_out(alloc)


@router.patch("/delivery-allocations/{allocation_id}", response_model=AllocationOut)
def update_allocation(
    allocation_id: str,
    body: AllocationUpdate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    alloc = db.get(DeliveryAllocation, allocation_id)
    if alloc is None:
        raise NotFound("Resource not found.")
    d = check_delivery_access(db, actor, alloc.delivery_id, AccessLevel.WRITE)
    ensure_mutable(d)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(alloc, field, value)
    db.commit()
    db.refresh(alloc)
    return allocation_out(alloc)


# ─────────────────────────────── logs ─────────────────────────────────────────
@router.get("/deliveries/{delivery_id}/logs")
def delivery_logs(
    delivery_id: str,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    check_delivery_access(db, actor, delivery_id, AccessLevel.READ)
    rows = db.execute(
        select(DeliveryLog).where(DeliveryLog.delivery_id == delivery_id)
        .order_by(DeliveryLog.timestamp.asc())
    ).scalars().all()
    return {"data": [DeliveryLogOut.model_validate(r) for r in rows]}


@router.get("/deliveries/{delivery_id}/assignment-logs")
def assignment_logs(
    delivery_id: str,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    check_delivery_access(db, actor, delivery_id, AccessLevel.READ)
    rows = db.execute(
        select(DeliveryAssignmentLog).where(DeliveryAssignmentLog.delivery_id == delivery_id)
        .order_by(DeliveryAssignmentLog.timestamp.asc())
    ).scalars().all()
    return {"data": [DeliveryAssignmentLogOut.model_validate(r) for r in rows]}


# ─────────────────────────────── delivery access (additional grants) ──────────
@router.get("/deliveries/{delivery_id}/access")
def list_access(
    delivery_id: str,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_current_actor),
):
    check_delivery_access(db, actor, delivery_id, AccessLevel.READ)
    rows = db.execute(
        select(DeliveryAccess).where(DeliveryAccess.delivery_id == delivery_id)
    ).scalars().all()
    return {"data": [DeliveryAccessOut.model_validate(r) for r in rows]}


@router.post("/deliveries/{delivery_id}/access", response_model=DeliveryAccessOut, status_code=201)
def grant_access(
    delivery_id: str,
    body: DeliveryAccessIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(UserRole.Administrator)),
):
    if db.get(Delivery, delivery_id) is None:
        raise NotFound("Resource not found.")
    existing = db.get(DeliveryAccess, {"delivery_id": delivery_id,
                                       "participant_id": body.participant_id})
    if existing is not None:
        existing.entity_type = body.entity_type
        existing.access_level = body.access_level
        grant = existing
    else:
        grant = DeliveryAccess(
            delivery_id=delivery_id,
            participant_id=body.participant_id,
            entity_type=body.entity_type,
            access_level=body.access_level,
        )
        db.add(grant)
    db.commit()
    db.refresh(grant)
    return DeliveryAccessOut.model_validate(grant)


@router.delete("/deliveries/{delivery_id}/access", status_code=204)
def revoke_access(
    delivery_id: str,
    participant_id: str = Query(...),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(UserRole.Administrator)),
):
    grant = db.get(DeliveryAccess, {"delivery_id": delivery_id,
                                    "participant_id": participant_id})
    if grant is None:
        raise NotFound("Resource not found.")
    db.delete(grant)
    db.commit()
    return Response(status_code=204)
