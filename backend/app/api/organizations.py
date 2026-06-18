from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.core.errors import Conflict, NotFound
from app.core.identity import create_organization
from app.core.pagination import PageParams, paginate, page_params
from app.database import get_db
from app.models.delivery import Delivery
from app.models.enums import OrgType, UserRole
from app.models.organization import Organization
from app.models.user import User
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationOut,
    OrganizationUpdate,
)

router = APIRouter(tags=["Organizations"])


def _get_or_404(db: Session, org_id: str) -> Organization:
    org = db.get(Organization, org_id)
    if org is None:
        raise NotFound("Resource not found.")
    return org


@router.get("/organizations")
def list_organizations(
    type: OrgType | None = Query(default=None),
    parent_id: str | None = Query(default=None),
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    stmt = select(Organization)
    if type is not None:
        stmt = stmt.where(Organization.type == type)
    if parent_id is not None:
        stmt = stmt.where(Organization.parent_id == parent_id)
    stmt = stmt.order_by(Organization.name.asc())
    rows, pagination = paginate(db, stmt, params)
    return {"data": [OrganizationOut.model_validate(o) for o in rows], "pagination": pagination}


@router.post("/organizations", response_model=OrganizationOut, status_code=201)
def register_organization(
    body: OrganizationCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(UserRole.Administrator)),
):
    org = create_organization(
        db,
        name=body.name,
        type=body.type,
        parent_id=body.parent_id,
        email=body.email,
        phone=body.phone,
        other_info=body.other_info or {},
        address_id=body.address_id,
    )
    db.commit()
    db.refresh(org)
    return OrganizationOut.model_validate(org)


@router.get("/organizations/{org_id}", response_model=OrganizationOut)
def get_organization(
    org_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return OrganizationOut.model_validate(_get_or_404(db, org_id))


@router.patch("/organizations/{org_id}", response_model=OrganizationOut)
def update_organization(
    org_id: str,
    body: OrganizationUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(UserRole.Administrator)),
):
    org = _get_or_404(db, org_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(org, field, value)
    db.commit()
    db.refresh(org)
    return OrganizationOut.model_validate(org)


@router.delete("/organizations/{org_id}", status_code=204)
def deactivate_organization(
    org_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(UserRole.Administrator)),
):
    org = _get_or_404(db, org_id)
    # Never hard-delete if dependents exist — deactivate instead.
    has_users = db.scalar(
        select(User.id).where(User.organization_id == org_id).limit(1)
    )
    has_deliveries = db.scalar(
        select(Delivery.id)
        .where(or_(Delivery.sender_id == org.universal_id,
                   Delivery.recipient_id == org.universal_id))
        .limit(1)
    )
    if has_users or has_deliveries:
        raise Conflict("Organization has dependents (users or deliveries) and cannot be deleted.")
    org.is_active = False
    db.commit()
    return Response(status_code=204)


@router.get("/organizations/{org_id}/performance")
def organization_performance(
    org_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    # Phase 3 stub — real metrics computed in Phase 7.
    _get_or_404(db, org_id)
    return {
        "organization_id": org_id,
        "delivery_success_rate": 0.0,
        "avg_confirmation_minutes": 0.0,
        "missed_deliveries": 0,
        "issues_raised": 0,
    }
