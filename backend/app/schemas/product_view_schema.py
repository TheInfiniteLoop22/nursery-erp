from pydantic import BaseModel
from typing import Optional

class ProductView(BaseModel):
    product_id: str
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
    ordered_quantity: int
    base_price_per_unit: str
    rate_percentage: str
    image_url: Optional[str] = None
