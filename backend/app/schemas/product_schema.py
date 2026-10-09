from decimal import Decimal

from pydantic import BaseModel, Field, HttpUrl, conint, condecimal
from typing import Literal

class ProductCreateRequest(BaseModel):
    nursery_id: str = Field(..., min_length=1)
    item_name: str = Field(..., min_length=2, max_length=200)
    section: Literal["tree", "shrubs", "perennials"] = "tree"
    zones: conint(ge=1) = 1
    subzone: str | None = None
    size: str | None = Field(default=None, max_length=120)
    height_feet: str = Field(default="N/A", max_length=20)
    caliper_inches: str = Field(default="N/A", max_length=20)
    gallons: str | None = None

    inventory_quantity: conint(ge=0) = 0
    ordered_quantity: conint(ge=0) = 0
    low_stock_threshold: conint(ge=0) = 10

    base_price_per_unit: condecimal(gt=0, max_digits=12, decimal_places=2)
    rate_percentage: condecimal(gt=0, max_digits=14, decimal_places=6, le=1000) = Field(
        default=Decimal("2.25"),
        description="Unit price multiplier (final = base × rate)",
    )

    image_url: HttpUrl | None = None


class ProductCreateResponse(BaseModel):
    product_id: str
    message: str


class ProductUpdateRequest(BaseModel):
    nursery_id: str = Field(..., min_length=1)
    item_name: str = Field(..., min_length=2, max_length=200)
    section: Literal["tree", "shrubs", "perennials"] = "tree"
    zones: conint(ge=1) = 1
    subzone: str | None = None
    size: str | None = Field(default=None, max_length=120)
    height_feet: str = Field(default="N/A", max_length=20)
    caliper_inches: str = Field(default="N/A", max_length=20)
    gallons: str | None = None
    inventory_quantity: conint(ge=0)
    low_stock_threshold: conint(ge=0) = 10
    base_price_per_unit: condecimal(gt=0, max_digits=12, decimal_places=2)
    rate_percentage: condecimal(gt=0, max_digits=14, decimal_places=6, le=1000)
    image_url: HttpUrl | None = None


class ProductUpdateResponse(BaseModel):
    product_id: str
    message: str


class ProductDeleteResponse(BaseModel):
    product_id: str
    message: str


class ProductAddStockRequest(BaseModel):
    quantity: conint(gt=0)


class ProductAddStockResponse(BaseModel):
    product_id: str
    added_quantity: int
    inventory_quantity: int
    message: str
