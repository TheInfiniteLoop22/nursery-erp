from sqlalchemy import Column, String, Integer, ForeignKey, Numeric
from app.core.database import Base

class OrderedProducts(Base):
    __tablename__ = "ordered_products"

    order_id = Column(
        String,
        ForeignKey("order_table.order_id", ondelete="CASCADE"),
        primary_key=True
    )

    product_id = Column(
        String,
        ForeignKey("product.product_id", ondelete="CASCADE"),
        primary_key=True
    )

    quantity = Column(Integer, nullable=False)

    unit_price = Column(Numeric(12, 2), nullable=False)
    rate_percentage = Column(Numeric(14, 6), nullable=True)

    total_price = Column(Numeric(14, 2), nullable=False)
