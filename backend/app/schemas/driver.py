from pydantic import BaseModel, ConfigDict


class DriverOut(BaseModel):
    """Driver response. ``password_hash`` is intentionally absent."""

    model_config = ConfigDict(from_attributes=True)

    driver_id: str
    driver_name: str
    mobile: str
    email: str | None = None
    address: str | None = None
    other_info: dict | None = None
    is_available: bool = True


class DriverCreate(BaseModel):
    driver_name: str
    mobile: str
    email: str | None = None
    address: str | None = None
    other_info: dict | None = None
    is_available: bool = True
    # Write-only extension (not in OpenAPI Driver schema): enables driver login.
    password: str | None = None


class DriverUpdate(BaseModel):
    driver_name: str | None = None
    mobile: str | None = None
    email: str | None = None
    address: str | None = None
    other_info: dict | None = None
    is_available: bool | None = None
    password: str | None = None
