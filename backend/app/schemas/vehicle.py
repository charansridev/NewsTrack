from typing import Literal

from pydantic import BaseModel, ConfigDict


class VehicleCreate(BaseModel):
    vehicle_number: str
    vehicle_type: Literal["2W", "3W", "5W"]
    capacity: int | None = None
    current_driver: str | None = None
    other_details: dict | None = None


class VehicleUpdate(BaseModel):
    vehicle_number: str | None = None
    vehicle_type: Literal["2W", "3W", "5W"] | None = None
    capacity: int | None = None
    current_driver: str | None = None
    other_details: dict | None = None


class VehicleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    vehicle_id: str
    vehicle_number: str
    vehicle_type: str
    capacity: int | None = None
    current_driver: str | None = None
    other_details: dict | None = None
    is_available: bool
