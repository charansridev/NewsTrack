"""Product inventory: the authoritative stock ledger.

One ``ProductInventory`` row per (product, organization). ``received_stock`` is
cumulative inbound; ``current_stock`` is on hand. Stock moves only through
delivery dispatch (debit sender) / receipt (credit recipient) or administrative
adjustment — never through the metadata PATCH.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import EntityType, InventoryStatus
from app.models.inventory import ProductInventory
from app.models.universal_id import UniversalID


def org_id_for_universal(db: Session, universal_id: str | None) -> str | None:
    """Return the organization id behind a universal_id, or None if it's a USER."""
    if universal_id is None:
        return None
    uid = db.get(UniversalID, universal_id)
    if uid is None or uid.entity_type != EntityType.ORG:
        return None
    return uid.entity_id


def get_by_id(db: Session, inventory_id: str) -> ProductInventory | None:
    return db.get(ProductInventory, inventory_id)


def get_org_product(db: Session, org_id: str, product_id: str) -> ProductInventory | None:
    return db.execute(
        select(ProductInventory).where(
            ProductInventory.organization_id == org_id,
            ProductInventory.product_id == product_id,
        )
    ).scalar_one_or_none()


def _refresh_status(row: ProductInventory) -> None:
    if row.status == InventoryStatus.Archived:
        return
    row.status = InventoryStatus.OutOfStock if row.current_stock <= 0 else InventoryStatus.Available


def _ensure_row(db: Session, org_id: str, product_id: str) -> ProductInventory:
    row = get_org_product(db, org_id, product_id)
    if row is None:
        row = ProductInventory(
            organization_id=org_id, product_id=product_id,
            received_stock=0, current_stock=0, status=InventoryStatus.Available,
        )
        db.add(row)
        db.flush()
    return row


def admin_adjust(db: Session, org_id: str, product_id: str, *,
                 delta: int | None = None, set_quantity: int | None = None,
                 status: InventoryStatus | None = None,
                 other_info: dict | None = None) -> ProductInventory:
    """Administrative stock entry/correction. ``set_quantity`` sets current_stock
    absolutely; ``delta`` applies a signed change. Positive movement also raises
    received_stock (cumulative inbound)."""
    row = _ensure_row(db, org_id, product_id)
    if set_quantity is not None:
        diff = set_quantity - row.current_stock
        row.current_stock = max(0, set_quantity)
        if diff > 0:
            row.received_stock += diff
    elif delta is not None:
        row.current_stock = max(0, row.current_stock + delta)
        if delta > 0:
            row.received_stock += delta
    if other_info is not None:
        row.other_info = other_info
    if status is not None:
        row.status = status
    else:
        _refresh_status(row)
    return row


def credit_receipt(db: Session, org_id: str, product_id: str, qty: int) -> ProductInventory:
    """Recipient receives goods (on Delivered): create/raise its inventory row."""
    row = _ensure_row(db, org_id, product_id)
    row.received_stock += qty
    row.current_stock += qty
    _refresh_status(row)
    return row


def debit(db: Session, inventory_id: str, qty: int) -> None:
    """Sender ships goods (on Dispatched): reduce that inventory row's stock."""
    row = get_by_id(db, inventory_id)
    if row is None:
        return
    row.current_stock = max(0, row.current_stock - qty)
    _refresh_status(row)
