from decimal import Decimal

from pydantic import BaseModel, Field, HttpUrl, conint, condecimal
from typing import Optional
from datetime import datetime
from typing import Literal


class ProductSubmissionCreateRequest(BaseModel):
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
    image_url: HttpUrl | None = None


class ProductSubmissionCreateResponse(BaseModel):
    submission_id: str
    message: str


class ProductSubmissionView(BaseModel):
    submission_id: str
    employee_id: str
    employee_username: str
    nursery_id: str
    item_name: str
    section: str
    zones: int
    subzone: str | None = None
    size: str
    height_feet: str = "N/A"
    caliper_inches: str = "N/A"
    gallons: str | None = None
    inventory_quantity: int
    image_url: Optional[str] = None
    status: str
    approved_product_id: Optional[str] = None
    barcode_status: str = "NOT_SET"
    barcode_printed_at: Optional[datetime] = None
    barcode_printed_by: Optional[str] = None
    reviewed_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ProductSubmissionApproveRequest(BaseModel):
    base_price_per_unit: condecimal(gt=0, max_digits=12, decimal_places=2)
    rate_percentage: condecimal(gt=0, max_digits=14, decimal_places=6, le=1000) = Field(default=Decimal("2.25"))
    item_name: Optional[str] = None


class ProductSubmissionApproveResponse(BaseModel):
    submission_id: str
    product_id: str
    message: str


class ProductSubmissionBarcodeStatusRequest(BaseModel):
    barcode_status: Literal["PENDING_NURSERY_PRINT", "PRINTED_BY_ADMIN", "PRINTED_BY_NURSERY"]


class ProductSubmissionBarcodeStatusResponse(BaseModel):
    submission_id: str
    barcode_status: str
    message: str
