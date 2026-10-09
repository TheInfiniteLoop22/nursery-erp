from sqlalchemy import Column, String, ForeignKey, Integer, TIMESTAMP, text
from app.core.database import Base

class EmployeeScanLog(Base):
    __tablename__ = "employee_scan_log"

    scan_id = Column(String, primary_key=True, index=True)

    employee_id = Column(
        String,
        ForeignKey("user_table.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    order_id = Column(
        String,
        ForeignKey("order_table.order_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    product_id = Column(
        String,
        ForeignKey("product.product_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    scanned_quantity = Column(Integer, nullable=False)

    scanned_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()")
    )
