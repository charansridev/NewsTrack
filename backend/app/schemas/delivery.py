from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import (
    AccessLevel,
    AllocationStatus,
    DeliveryStatus,
    DeliveryType,
    EntityType,
)
from app.schemas.references import ActorInput, ActorRef


# ── Delivery allocations (a quantity drawn from a sender inventory record) ─────
class AllocationIn(BaseModel):
    inventory_id: str
    expected_quantity: int


class AllocationAdd(BaseModel):
    inventory_id: str
    expected_quantity: int


class AllocationUpdate(BaseModel):
    expected_quantity: int | None = None
    confirmed_quantity: int | None = None
    status: AllocationStatus | None = None


class AllocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    allocation_id: str
    inventory_id: str
    delivery_id: str
    expected_quantity: int
    confirmed_quantity: int | None = None
    status: AllocationStatus


# ── Delivery ──────────────────────────────────────────────────────────────────
class DeliveryCreate(BaseModel):
    type: DeliveryType
    sender: ActorInput
    recipient: ActorInput
    parent_delivery_id: str | None = None
    sender_address_id: str | None = None
    recipient_address_id: str | None = None
    planned_duration: int | None = None
    note: str | None = None
    allocations: list[AllocationIn] = []


class DeliveryUpdate(BaseModel):
    planned_duration: int | None = None
    note: str | None = None
    sender_address_id: str | None = None
    recipient_address_id: str | None = None


class DeliveryOut(BaseModel):
    id: str
    parent_delivery_id: str | None = None
    type: DeliveryType
    sender: ActorRef | None = None
    recipient: ActorRef | None = None
    driver_id: str | None = None
    vehicle_id: str | None = None
    status: DeliveryStatus
    is_active: bool
    created_by: ActorRef | None = None
    created_at: datetime | None = None
    sender_address_id: str | None = None
    recipient_address_id: str | None = None
    sender_address_snapshot: str | None = None
    recipient_address_snapshot: str | None = None
    planned_duration: int | None = None
    confirmed_by: ActorRef | None = None
    confirmed_at: datetime | None = None
    photo_url: str | None = None
    has_issue: bool = False
    issue_count: int = 0
    note: str | None = None
    allocations: list[AllocationOut] = []


# ── Action payloads ─────────────────────────────────────────────────────────
class StatusChangeIn(BaseModel):
    status: DeliveryStatus
    remark: str | None = None


class AssignIn(BaseModel):
    driver_id: str | None = None
    vehicle_id: str | None = None
    remark: str | None = None


class ConfirmAllocationIn(BaseModel):
    allocation_id: str
    confirmed_quantity: int


class ConfirmIn(BaseModel):
    photo_url: str | None = None
    allocations: list[ConfirmAllocationIn] = []


# ── Logs ──────────────────────────────────────────────────────────────────────
class DeliveryLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    delivery_id: str
    action: str
    remark: str | None = None
    user_id: str | None = None
    timestamp: datetime


class DeliveryAssignmentLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    action: str
    entity_type: str | None = None
    timestamp: datetime
    driver_id: str | None = None
    vehicle_id: str | None = None
    delivery_id: str


# ── Delivery Access (additional grants) ───────────────────────────────────────
class DeliveryAccessIn(BaseModel):
    participant_id: str  # universal_id of grantee
    entity_type: EntityType
    access_level: AccessLevel


class DeliveryAccessOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    delivery_id: str
    participant_id: str
    entity_type: EntityType
    access_level: AccessLevel
