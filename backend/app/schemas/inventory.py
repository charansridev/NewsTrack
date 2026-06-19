from datetime import datetime

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.enums import InventoryStatus


class ProductInventoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    inventory_id: str
    product_id: str
    organization_id: str
    received_stock: int
    current_stock: int
    status: InventoryStatus
    other_info: dict | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class InventoryMetadataUpdate(BaseModel):
    """PATCH /inventory/{id} — metadata only (never stock quantities)."""

    status: InventoryStatus | None = None
    other_info: dict | None = None


class InventoryAdjustIn(BaseModel):
    """Administrative stock entry / correction (POST /inventory)."""

    organization_id: str
    product_id: str
    delta: int | None = None
    set_quantity: int | None = None
    status: InventoryStatus | None = None
    other_info: dict | None = None
    note: str | None = None

    @model_validator(mode="after")
    def _one_of(self):
        if (self.delta is None) == (self.set_quantity is None):
            raise ValueError("Provide exactly one of 'delta' or 'set_quantity'.")
        return self
