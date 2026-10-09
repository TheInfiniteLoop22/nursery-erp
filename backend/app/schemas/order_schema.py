from pydantic import BaseModel, Field, conint, condecimal, model_validator
from typing import Optional, List, Literal

WorkOrderType = Literal["MAINTENANCE", "INSTALL"]

class OrderCreateRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    client_name: str = Field(..., min_length=2, max_length=200)
    work_order_type: WorkOrderType = "INSTALL"
    designer_name: Literal["Alex", "Jordan", "Taylor"]


class OrderCreateResponse(BaseModel):
    order_id: str
    status: str
    message: str


class OrderAddProductRequest(BaseModel):
    product_id: str = Field(..., min_length=1)
    quantity: conint(gt=0)
    unit_price: condecimal(gt=0, max_digits=12, decimal_places=2)
    rate_percentage: Optional[condecimal(gt=0, max_digits=14, decimal_places=6)] = None


class OrderProductActionResponse(BaseModel):
    order_id: str
    product_id: str
    quantity: int
    line_total: str
    order_total: str
    message: str


class OrderRemoveProductRequest(BaseModel):
    product_id: str = Field(..., min_length=1)
    quantity: Optional[conint(gt=0)] = None


class OrderedProductView(BaseModel):
    product_id: str
    quantity: int
    unit_price: str
    rate_percentage: str | None
    total_price: str


class OrderDetailResponse(BaseModel):
    order_id: str
    user_id: str
    client_name: str
    work_order_type: WorkOrderType
    designer_name: Optional[str] = None
    status: str
    total_order_amount: str
    ordered_at: str
    updated_at: str
    invoice_generated_at: Optional[str] = None
    paid_at: Optional[str] = None
    items: List[OrderedProductView]


class OrderUpdateRequest(BaseModel):
    client_name: Optional[str] = None
    work_order_type: Optional[WorkOrderType] = None
    designer_name: Optional[Literal["Alex", "Jordan", "Taylor"]] = None

    @model_validator(mode="after")
    def require_at_least_one_field(self):
        if self.client_name is None and self.work_order_type is None and self.designer_name is None:
            raise ValueError("Provide client_name, work_order_type, and/or designer_name")
        return self


class OrderListItem(BaseModel):
    order_id: str
    user_id: str
    client_name: str
    work_order_type: WorkOrderType
    designer_name: Optional[str] = None
    status: str
    total_order_amount: str
    ordered_at: str
    updated_at: str
    invoice_generated_at: Optional[str] = None
    paid_at: Optional[str] = None
    items_count: int


class PaginatedOrderListResponse(BaseModel):
    items: List[OrderListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class OrderListSummaryResponse(BaseModel):
    total: int
    created: int
    in_progress: int
    completed: int
