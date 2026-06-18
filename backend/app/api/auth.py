import jwt
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.dependencies import get_current_user
from app.core.errors import Unauthorized
from app.core.security import (
    create_driver_access_token,
    create_user_access_token,
    create_user_refresh_token,
    decode_user_token,
    verify_password,
)
from app.database import get_db
from app.models.driver import Driver
from app.models.user import User
from app.schemas.auth import (
    DriverLoginIn,
    DriverLoginOut,
    RefreshIn,
    RefreshOut,
    UserLoginIn,
    UserLoginOut,
)
from app.schemas.user import UserOut

router = APIRouter(tags=["Auth"])


@router.post("/auth/login", response_model=UserLoginOut)
def user_login(body: UserLoginIn, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    if user is None or not user.is_active or not verify_password(body.password, user.password_hash):
        raise Unauthorized("Invalid credentials.")
    access = create_user_access_token(
        user.id, user.universal_id, user.organization_id, user.role.value
    )
    refresh = create_user_refresh_token(user.id)
    return UserLoginOut(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.user_access_token_ttl,
        universal_id=user.universal_id,
        user=UserOut.model_validate(user),
    )


@router.post("/auth/refresh", response_model=RefreshOut)
def user_refresh(body: RefreshIn, db: Session = Depends(get_db)):
    try:
        payload = decode_user_token(body.refresh_token)
    except jwt.PyJWTError:
        raise Unauthorized("Invalid or expired refresh token.")
    if payload.get("token_use") != "user_refresh":
        raise Unauthorized("Not a refresh token.")
    user = db.get(User, payload.get("sub"))
    if user is None or not user.is_active:
        raise Unauthorized("User not found or inactive.")
    access = create_user_access_token(
        user.id, user.universal_id, user.organization_id, user.role.value
    )
    return RefreshOut(access_token=access, expires_in=settings.user_access_token_ttl)


@router.get("/auth/me", response_model=UserOut)
def auth_me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)


@router.post("/driver/auth/login", response_model=DriverLoginOut)
def driver_login(body: DriverLoginIn, db: Session = Depends(get_db)):
    driver = db.execute(
        select(Driver).where(Driver.mobile == body.mobile)
    ).scalar_one_or_none()
    if driver is None or not verify_password(body.password, driver.password_hash):
        raise Unauthorized("Invalid credentials.")
    access = create_driver_access_token(driver.driver_id)
    return DriverLoginOut(
        access_token=access,
        expires_in=settings.driver_access_token_ttl,
        driver=driver,
    )
