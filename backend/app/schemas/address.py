from pydantic import BaseModel, ConfigDict


class AddressCreate(BaseModel):
    address: str


class AddressOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    address: str
