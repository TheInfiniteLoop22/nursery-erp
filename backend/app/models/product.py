from sqlalchemy import Column, String, Integer, Numeric, ForeignKey, text
from app.core.database import Base

class Product(Base):
    __tablename__ = "product"

    product_id = Column(String, primary_key=True, index=True)

    nursery_id = Column(
        String,
        ForeignKey("nursery.nursery_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    item_name = Column(String, nullable=False)
    section = Column(String, nullable=False, server_default=text("'tree'"))
    zones = Column(Integer, nullable=False, default=1)
    subzone = Column(String, nullable=True)
    size = Column(String, nullable=False)
    gallons = Column(String, nullable=True)

    inventory_quantity = Column(Integer, nullable=False, default=0)
    ordered_quantity = Column(Integer, nullable=False, default=0)
    low_stock_threshold = Column(Integer, nullable=False, default=10)

    base_price_per_unit = Column(Numeric(12, 2), nullable=False)
    rate_percentage = Column(Numeric(14, 6), nullable=False, default=0)

    image_url = Column(String, nullable=True)
