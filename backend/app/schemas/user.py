from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.enums import UserRole


class UserCreate(BaseModel):
    organization_id: str
    name: str
    email: EmailStr
    role: UserRole
    mobile: str | None = None
    other_info: dict | None = None
    address_id: str | None = None
    # Write-only extension (not in the OpenAPI schema): lets a created user log
    # in. Optional — omit to create a login-less record.
    password: str | None = None


class UserUpdate(BaseModel):
    organization_id: str | None = None
    name: str | None = None
    email: EmailStr | None = None
    role: UserRole | None = None
    mobile: str | None = None
    other_info: dict | None = None
    address_id: str | None = None
    is_active: bool | None = None
    password: str | None = None


class UserOut(BaseModel):
    """User response. ``password_hash`` is intentionally absent."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    universal_id: str
    organization_id: str
    name: str
    email: EmailStr
    mobile: str | None = None
    role: UserRole
    other_info: dict | None = None
    is_active: bool = True
    address_id: str | None = None
