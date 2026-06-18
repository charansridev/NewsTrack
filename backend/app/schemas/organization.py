from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.enums import OrgType


class OrganizationCreate(BaseModel):
    name: str
    type: OrgType
    parent_id: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    other_info: dict | None = None
    address_id: str | None = None


class OrganizationUpdate(BaseModel):
    name: str | None = None
    type: OrgType | None = None
    parent_id: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    other_info: dict | None = None
    address_id: str | None = None
    is_active: bool | None = None


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    universal_id: str
    parent_id: str | None = None
    name: str
    type: OrgType
    email: str | None = None
    phone: str | None = None
    other_info: dict | None = None
    address_id: str | None = None
    is_active: bool = True
