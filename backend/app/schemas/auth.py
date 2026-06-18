from pydantic import BaseModel, EmailStr

from app.schemas.driver import DriverOut
from app.schemas.user import UserOut


class UserLoginIn(BaseModel):
    email: EmailStr
    password: str


class UserLoginOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int
    universal_id: str
    user: UserOut


class RefreshIn(BaseModel):
    refresh_token: str


class RefreshOut(BaseModel):
    access_token: str
    expires_in: int


class DriverLoginIn(BaseModel):
    mobile: str
    password: str


class DriverLoginOut(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    driver: DriverOut
