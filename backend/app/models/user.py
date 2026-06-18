from sqlalchemy import Boolean, Enum as SAEnum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import UserRole
from app.models.types import JSONType, UUIDType, new_uuid


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    universal_id: Mapped[str] = mapped_column(
        UUIDType, ForeignKey("universal_id.id"), nullable=False, unique=True
    )
    organization_id: Mapped[str] = mapped_column(
        UUIDType, ForeignKey("organizations.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    mobile: Mapped[str | None] = mapped_column(String(50), nullable=True)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, name="user_role"), nullable=False)
    other_info: Mapped[dict | None] = mapped_column(JSONType, nullable=True, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    address_id: Mapped[str | None] = mapped_column(
        UUIDType, ForeignKey("addresses.id"), nullable=True
    )
    # Added for auth; never serialized into any response schema.
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
