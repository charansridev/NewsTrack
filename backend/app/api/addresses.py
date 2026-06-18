from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.errors import NotFound
from app.core.pagination import PageParams, paginate, page_params
from app.database import get_db
from app.models.address import Address
from app.models.user import User
from app.schemas.address import AddressCreate, AddressOut

router = APIRouter(tags=["Addresses"])


@router.get("/addresses")
def list_addresses(
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    stmt = select(Address).order_by(Address.id.asc())
    rows, pagination = paginate(db, stmt, params)
    return {"data": [AddressOut.model_validate(a) for a in rows], "pagination": pagination}


@router.post("/addresses", response_model=AddressOut, status_code=201)
def create_address(
    body: AddressCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    addr = Address(address=body.address)
    db.add(addr)
    db.commit()
    db.refresh(addr)
    return AddressOut.model_validate(addr)


@router.get("/addresses/{address_id}", response_model=AddressOut)
def get_address(
    address_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    addr = db.get(Address, address_id)
    if addr is None:
        raise NotFound("Resource not found.")
    return AddressOut.model_validate(addr)
