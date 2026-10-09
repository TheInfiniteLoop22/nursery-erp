from pydantic import BaseModel
from typing import Optional


class NurseryCreateRequest(BaseModel):
    nursery_name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None


class NurseryUpdateRequest(BaseModel):
    nursery_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None


class NurseryView(BaseModel):
    nursery_id: str
    nursery_name: str


class NurseryProductView(BaseModel):
    product_id: str
    item_name: str
    size: str
    height_feet: str = "N/A"
    caliper_inches: str = "N/A"
    inventory_quantity: int
    ordered_quantity: int
    image_url: Optional[str] = None


class NurserySummaryView(BaseModel):
    nursery_id: str
    nursery_name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    products_count: int
    total_inventory: int
    total_ordered_quantity: int
    featured_products: list[str]


class NurseryDetailView(NurserySummaryView):
    notes: Optional[str] = None
    products: list[NurseryProductView]


class NurseryActionResponse(BaseModel):
    nursery_id: str
    message: str


class PaginatedNurseryListResponse(BaseModel):
    items: list[NurserySummaryView]
    total: int
    page: int
    page_size: int
    total_pages: int


class NurseryListSummaryResponse(BaseModel):
    total_vendors: int
    total_products: int
    total_inventory: int
    total_ordered_quantity: int
