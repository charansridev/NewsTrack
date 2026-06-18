from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.core.errors import BadRequest, NotFound
from app.core.identity import create_user
from app.core.pagination import PageParams, paginate, page_params
from app.core.security import hash_password
from app.database import get_db
from app.models.enums import UserRole
from app.models.organization import Organization
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, UserUpdate

router = APIRouter(tags=["Users"])


def _get_or_404(db: Session, user_id: str) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise NotFound("Resource not found.")
    return user


@router.get("/users")
def list_users(
    organization_id: str | None = Query(default=None),
    role: UserRole | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    stmt = select(User)
    if organization_id is not None:
        stmt = stmt.where(User.organization_id == organization_id)
    if role is not None:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
    stmt = stmt.order_by(User.name.asc())
    rows, pagination = paginate(db, stmt, params)
    return {"data": [UserOut.model_validate(u) for u in rows], "pagination": pagination}


@router.post("/users", response_model=UserOut, status_code=201)
def create_user_endpoint(
    body: UserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(UserRole.Administrator)),
):
    if db.get(Organization, body.organization_id) is None:
        raise BadRequest("organization_id does not reference an existing organization.")
    fields = body.model_dump(exclude={"password"})
    fields["other_info"] = fields.get("other_info") or {}
    if body.password:
        fields["password_hash"] = hash_password(body.password)
    user = create_user(db, **fields)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return UserOut.model_validate(_get_or_404(db, user_id))


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    body: UserUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(UserRole.Administrator)),
):
    user = _get_or_404(db, user_id)
    data = body.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    if password:
        user.password_hash = hash_password(password)
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/users/{user_id}", status_code=204)
def disable_user(
    user_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(UserRole.Administrator)),
):
    user = _get_or_404(db, user_id)
    user.is_active = False  # soft-disable; never hard-delete
    db.commit()
    return Response(status_code=204)
