from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.types import JSONType, UUIDType, new_uuid


class Driver(Base):
    __tablename__ = "drivers"

    driver_id: Mapped[str] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    driver_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mobile: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    other_info: Mapped[dict | None] = mapped_column(JSONType, nullable=True, default=dict)
    is_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Added for the separate driver auth system; never serialized.
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
