from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_product_creator
from app.core.errors import NotFound
from app.core.pagination import PageParams, paginate, page_params
from app.database import get_db
from app.models.product import Product
from app.models.user import User
from app.metadata_schemas import validate_other_info
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate
from app.services.references import expand_reference

router = APIRouter(tags=["Products"])


def product_out(db: Session, product: Product) -> ProductOut:
    """Serialize a Product (catalog record), expanding created_by."""
    return ProductOut(
        product_id=product.product_id,
        organization_id=product.organization_id,
        created_by=expand_reference(db, product.created_by),
        created_at=product.created_at,
        name=product.name,
        sku=product.sku,
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
    validate_other_info("product", None, body.other_info)
    # All ownership/provenance fields are server-derived — never trusted from
    # the body — so a caller cannot forge a product onto another organization.
    product = Product(
        organization_id=user.organization_id,
        created_by=user.universal_id,
        name=body.name,
        sku=body.sku,
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


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: str,
    body: ProductUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    # Catalog/metadata only — products carry no stock; stock lives in inventory.
    product = _get_or_404(db, product_id)
    data = body.model_dump(exclude_unset=True)
    if "other_info" in data:
        validate_other_info("product", None, data["other_info"])
    for field, value in data.items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product_out(db, product)
