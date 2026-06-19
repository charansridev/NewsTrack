from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.core.errors import BadRequest, NotFound
from app.core.pagination import PageParams, paginate, page_params
from app.database import get_db
from app.models.driver import Driver
from app.models.enums import UserRole
from app.models.user import User
from app.models.vehicle import Vehicle
from app.metadata_schemas import validate_other_info
from app.schemas.vehicle import VehicleCreate, VehicleOut, VehicleUpdate

router = APIRouter(tags=["Vehicles"])

_MANAGERS = (UserRole.Administrator, UserRole.DistributionManager)


def _get_or_404(db: Session, vehicle_id: str) -> Vehicle:
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise NotFound("Resource not found.")
    return vehicle


def _validate_driver(db: Session, driver_id: str | None) -> None:
    if driver_id is not None and db.get(Driver, driver_id) is None:
        raise BadRequest("current_driver does not reference an existing driver.")


@router.get("/vehicles")
def list_vehicles(
    vehicle_type: str | None = Query(default=None),
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    stmt = select(Vehicle)
    if vehicle_type is not None:
        stmt = stmt.where(Vehicle.vehicle_type == vehicle_type)
    stmt = stmt.order_by(Vehicle.vehicle_number.asc())
    rows, pagination = paginate(db, stmt, params)
    return {"data": [VehicleOut.model_validate(v) for v in rows], "pagination": pagination}


@router.post("/vehicles", response_model=VehicleOut, status_code=201)
def register_vehicle(
    body: VehicleCreate,
    db: Session = Depends(get_db),
    _mgr: User = Depends(require_roles(*_MANAGERS)),
):
    validate_other_info("vehicle", body.vehicle_type, body.other_details)
    _validate_driver(db, body.current_driver)
    vehicle = Vehicle(
        vehicle_number=body.vehicle_number,
        vehicle_type=body.vehicle_type,
        capacity=body.capacity,
        current_driver=body.current_driver,
        other_details=body.other_details or {},
    )
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return VehicleOut.model_validate(vehicle)


@router.get("/vehicles/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(
    vehicle_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return VehicleOut.model_validate(_get_or_404(db, vehicle_id))


@router.patch("/vehicles/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(
    vehicle_id: str,
    body: VehicleUpdate,
    db: Session = Depends(get_db),
    _mgr: User = Depends(require_roles(*_MANAGERS)),
):
    vehicle = _get_or_404(db, vehicle_id)
    data = body.model_dump(exclude_unset=True)
    if "other_details" in data:
        vtype = data.get("vehicle_type") or vehicle.vehicle_type
        validate_other_info("vehicle", vtype, data["other_details"])
    if "current_driver" in data:
        _validate_driver(db, data["current_driver"])
    for field, value in data.items():
        setattr(vehicle, field, value)
    db.commit()
    db.refresh(vehicle)
    return VehicleOut.model_validate(vehicle)
