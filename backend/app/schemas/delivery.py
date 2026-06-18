from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import (
    AccessLevel,
    DeliveryItemStatus,
    DeliveryStatus,
    DeliveryType,
    EntityType,
)
from app.schemas.references import ActorInput, ActorRef


# ── Delivery items ────────────────────────────────────────────────────────────
class DeliveryItemIn(BaseModel):
    product_id: str
    expected_quantity: int


class DeliveryItemAdd(BaseModel):
    product_id: str
    expected_quantity: int
    note: str | None = None


class DeliveryItemUpdate(BaseModel):
    expected_quantity: int | None = None
    confirmed_quantity: int | None = None
    status: DeliveryItemStatus | None = None
    note: str | None = None


class DeliveryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    delivery_id: str
    expected_quantity: int
    confirmed_quantity: int | None = None
    status: DeliveryItemStatus
    note: str | None = None


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
    items: list[DeliveryItemIn] = []


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
    items: list[DeliveryItemOut] = []


# ── Action payloads ─────────────────────────────────────────────────────────
class StatusChangeIn(BaseModel):
    status: DeliveryStatus
    remark: str | None = None


class AssignIn(BaseModel):
    driver_id: str | None = None
    vehicle_id: str | None = None
    remark: str | None = None


class ConfirmItemIn(BaseModel):
    item_id: str
    confirmed_quantity: int


class ConfirmIn(BaseModel):
    photo_url: str | None = None
    items: list[ConfirmItemIn] = []


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
