from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.references import ActorRef


class ProductCreate(BaseModel):
    name: str
    sku: str | None = None
    short_description: str | None = None
    description: str | None = None
    other_info: dict | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    sku: str | None = None
    short_description: str | None = None
    description: str | None = None
    other_info: dict | None = None


class ProductOut(BaseModel):
    """Catalog/master record. Available stock lives in Product Inventory."""

    model_config = ConfigDict(from_attributes=True)

    product_id: str
    organization_id: str | None = None
    created_by: ActorRef | None = None
    created_at: datetime | None = None
    name: str
    sku: str | None = None
    short_description: str | None = None
    description: str | None = None
    other_info: dict | None = None
