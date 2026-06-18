from sqlalchemy import Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.types import UUIDType, new_uuid


class Address(Base):
    __tablename__ = "addresses"

    id: Mapped[str] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    address: Mapped[str] = mapped_column(Text, nullable=False)
