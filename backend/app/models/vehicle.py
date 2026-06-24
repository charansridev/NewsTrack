from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.types import JSONType, UUIDType, new_uuid


class Vehicle(Base):
    __tablename__ = "vehicles"

    vehicle_id: Mapped[str] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    vehicle_number: Mapped[str] = mapped_column(
        String(50), nullable=False, unique=True, index=True
    )
    vehicle_type: Mapped[str] = mapped_column(String(10), nullable=False)  # 2W | 3W | 5W
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_driver: Mapped[str | None] = mapped_column(
        UUIDType, ForeignKey("drivers.driver_id"), nullable=True
    )
    other_details: Mapped[dict | None] = mapped_column(JSONType, nullable=True, default=dict)
    is_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
