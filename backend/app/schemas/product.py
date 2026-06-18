from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.references import ActorRef


class ProductCreate(BaseModel):
    name: str
    stocks: int | None = 0
    short_description: str | None = None
    description: str | None = None
    other_info: dict | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    stocks: int | None = None
    short_description: str | None = None
    description: str | None = None
    other_info: dict | None = None


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: str
    organization_id: str | None = None
    created_by: ActorRef | None = None
    created_at: datetime | None = None
    name: str
    stocks: int | None = None
    short_description: str | None = None
    description: str | None = None
    other_info: dict | None = None
