from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_driver, get_current_user, require_roles
from app.core.errors import NotFound
from app.core.pagination import PageParams, paginate, page_params
from app.core.security import hash_password
from app.database import get_db
from app.models.driver import Driver
from app.models.delivery import Delivery
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.driver import DriverCreate, DriverOut, DriverUpdate
from app.services.deliveries import delivery_out

router = APIRouter(tags=["Drivers"])

_MANAGERS = (UserRole.Administrator, UserRole.DistributionManager)


def _get_or_404(db: Session, driver_id: str) -> Driver:
    driver = db.get(Driver, driver_id)
    if driver is None:
        raise NotFound("Resource not found.")
    return driver


@router.get("/drivers")
def list_drivers(
    is_available: bool | None = Query(default=None),
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    stmt = select(Driver)
    if is_available is not None:
        stmt = stmt.where(Driver.is_available == is_available)
    stmt = stmt.order_by(Driver.driver_name.asc())
    rows, pagination = paginate(db, stmt, params)
    return {"data": [DriverOut.model_validate(d) for d in rows], "pagination": pagination}


@router.post("/drivers", response_model=DriverOut, status_code=201)
def register_driver(
    body: DriverCreate,
    db: Session = Depends(get_db),
    _mgr: User = Depends(require_roles(*_MANAGERS)),
):
    fields = body.model_dump(exclude={"password"})
    fields["other_info"] = fields.get("other_info") or {}
    driver = Driver(**fields)
    if body.password:
        driver.password_hash = hash_password(body.password)
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return DriverOut.model_validate(driver)


# NOTE: declared before /drivers/{driver_id} so "me" isn't captured as an id.
@router.get("/driver/me/deliveries")
def my_deliveries(
    db: Session = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
):
    """Driver-facing list (driver JWT only): assigned deliveries + manifest."""
    rows = db.execute(
        select(Delivery).where(Delivery.driver_id == driver.driver_id)
        .order_by(Delivery.created_at.desc())
    ).scalars().all()
    return {"data": [delivery_out(db, d) for d in rows]}


@router.get("/drivers/{driver_id}", response_model=DriverOut)
def get_driver(
    driver_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return DriverOut.model_validate(_get_or_404(db, driver_id))


@router.patch("/drivers/{driver_id}", response_model=DriverOut)
def update_driver(
    driver_id: str,
    body: DriverUpdate,
    db: Session = Depends(get_db),
    _mgr: User = Depends(require_roles(*_MANAGERS)),
):
    driver = _get_or_404(db, driver_id)
    data = body.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    if password:
        driver.password_hash = hash_password(password)
    for field, value in data.items():
        setattr(driver, field, value)
    db.commit()
    db.refresh(driver)
    return DriverOut.model_validate(driver)
