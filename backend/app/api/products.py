from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_product_creator
from app.core.errors import Forbidden, NotFound
from app.core.pagination import PageParams, paginate, page_params
from app.database import get_db
from app.models.enums import OrgType, UserRole
from app.models.organization import Organization
from app.models.product import Product
from app.models.user import User
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate
from app.services.references import expand_reference

router = APIRouter(tags=["Products"])


def product_out(db: Session, product: Product) -> ProductOut:
    """Serialize a Product, expanding the polymorphic created_by reference."""
    return ProductOut(
        product_id=product.product_id,
        organization_id=product.organization_id,
        created_by=expand_reference(db, product.created_by),
        created_at=product.created_at,
        name=product.name,
        stocks=product.stocks,
        short_description=product.short_description,
        description=product.description,
        other_info=product.other_info,
    )


def _get_or_404(db: Session, product_id: str) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise NotFound("Resource not found.")
    return product


@router.get("/products")
def list_products(
    name: str | None = Query(default=None),
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    stmt = select(Product)
    if name is not None:
        stmt = stmt.where(Product.name.ilike(f"%{name}%"))
    if from_ is not None:
        stmt = stmt.where(Product.created_at >= from_)
    if to is not None:
        stmt = stmt.where(Product.created_at <= to)
    stmt = stmt.order_by(Product.created_at.desc())
    rows, pagination = paginate(db, stmt, params)
    return {"data": [product_out(db, p) for p in rows], "pagination": pagination}


@router.post("/products", response_model=ProductOut, status_code=201)
def create_product(
    body: ProductCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_product_creator),
):
    # All ownership/provenance fields are server-derived — never trusted from
    # the body — so a caller cannot forge a product onto another organization.
    product = Product(
        organization_id=user.organization_id,
        created_by=user.universal_id,
        name=body.name,
        stocks=body.stocks if body.stocks is not None else 0,
        short_description=body.short_description,
        description=body.description,
        other_info=body.other_info or {},
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product_out(db, product)


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(
    product_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return product_out(db, _get_or_404(db, product_id))


def _may_adjust_stock(db: Session, user: User, product: Product) -> bool:
    """Stock may be changed via PATCH only by an Administrator, or by a member
    of the product's owning Press organization."""
    if user.role == UserRole.Administrator:
        return True
    if product.organization_id and user.organization_id == product.organization_id:
        org = db.get(Organization, product.organization_id)
        if org is not None and org.type == OrgType.Press:
            return True
    return False


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: str,
    body: ProductUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    product = _get_or_404(db, product_id)
    data = body.model_dump(exclude_unset=True)

    # Stock integrity: `stocks` is a production-entry value. Only an Administrator
    # or the owning Press may adjust it via PATCH; routine decreases happen
    # through the dispatch workflow, not by direct edit.
    if "stocks" in data and data["stocks"] != product.stocks:
        if not _may_adjust_stock(db, user, product):
            raise Forbidden("You may not adjust stock for this product.")

    for field, value in data.items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product_out(db, product)
