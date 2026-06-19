from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.errors import BadRequest, Forbidden, NotFound
from app.core.pagination import PageParams, paginate, page_params
from app.database import get_db
from app.models.enums import UserRole
from app.models.inventory import ProductInventory
from app.models.organization import Organization
from app.models.product import Product
from app.models.user import User
from app.schemas.inventory import (
    InventoryAdjustIn,
    InventoryMetadataUpdate,
    ProductInventoryOut,
)
from app.services.inventory import admin_adjust

router = APIRouter(tags=["Product Inventory"])


def _get_or_404(db: Session, inventory_id: str) -> ProductInventory:
    row = db.get(ProductInventory, inventory_id)
    if row is None:
        raise NotFound("Resource not found.")
    return row


@router.get("/inventory")
def list_inventory(
    product_id: str | None = Query(default=None),
    organization_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    stmt = select(ProductInventory)
    if product_id is not None:
        stmt = stmt.where(ProductInventory.product_id == product_id)
    if organization_id is not None:
        stmt = stmt.where(ProductInventory.organization_id == organization_id)
    if status is not None:
        stmt = stmt.where(ProductInventory.status == status)
    stmt = stmt.order_by(ProductInventory.organization_id, ProductInventory.product_id)
    rows, pagination = paginate(db, stmt, params)
    return {"data": [ProductInventoryOut.model_validate(r) for r in rows], "pagination": pagination}


@router.post("/inventory", response_model=ProductInventoryOut, status_code=201)
def adjust_inventory(
    body: InventoryAdjustIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Administrative stock entry / correction (Administrator, or a member of the
    target organization). The only manual way stock enters or is corrected."""
    if db.get(Organization, body.organization_id) is None:
        raise BadRequest("organization_id does not reference an existing organization.")
    if db.get(Product, body.product_id) is None:
        raise BadRequest("product_id does not reference an existing product.")
    if user.role != UserRole.Administrator and user.organization_id != body.organization_id:
        raise Forbidden("You may only adjust your own organization's inventory.")

    row = admin_adjust(
        db, body.organization_id, body.product_id,
        delta=body.delta, set_quantity=body.set_quantity,
        status=body.status, other_info=body.other_info,
    )
    db.commit()
    db.refresh(row)
    return ProductInventoryOut.model_validate(row)


@router.get("/inventory/organization/{org_id}")
def org_inventory(
    org_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if db.get(Organization, org_id) is None:
        raise NotFound("Resource not found.")
    rows = db.execute(
        select(ProductInventory).where(ProductInventory.organization_id == org_id)
        .order_by(ProductInventory.product_id)
    ).scalars().all()
    return {"data": [ProductInventoryOut.model_validate(r) for r in rows]}


@router.get("/inventory/{inventory_id}", response_model=ProductInventoryOut)
def get_inventory(
    inventory_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return ProductInventoryOut.model_validate(_get_or_404(db, inventory_id))


@router.patch("/inventory/{inventory_id}", response_model=ProductInventoryOut)
def update_inventory_metadata(
    inventory_id: str,
    body: InventoryMetadataUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Metadata only (status / other_info). Stock quantities never change here."""
    row = _get_or_404(db, inventory_id)
    if user.role != UserRole.Administrator and user.organization_id != row.organization_id:
        raise Forbidden("You may only edit your own organization's inventory.")
    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return ProductInventoryOut.model_validate(row)
