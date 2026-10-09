from sqlalchemy import Column, String, Integer, ForeignKey, TIMESTAMP, text
from app.core.database import Base


class ProductSubmission(Base):
    __tablename__ = "product_submission"

    submission_id = Column(String, primary_key=True, index=True)

    employee_id = Column(
        String,
        ForeignKey("user_table.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    nursery_id = Column(
        String,
        ForeignKey("nursery.nursery_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    item_name = Column(String, nullable=False)
    section = Column(String, nullable=False, server_default=text("'tree'"))
    zones = Column(Integer, nullable=False, default=1)
    subzone = Column(String, nullable=True)
    size = Column(String, nullable=False)
    gallons = Column(String, nullable=True)
    inventory_quantity = Column(Integer, nullable=False, default=0)
    image_url = Column(String, nullable=True)

    status = Column(String, nullable=False, server_default=text("'PENDING'"))
    approved_product_id = Column(String, nullable=True, index=True)
    barcode_status = Column(String, nullable=False, server_default=text("'NOT_SET'"))
    barcode_printed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    barcode_printed_by = Column(
        String,
        ForeignKey("user_table.user_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reviewed_by = Column(
        String,
        ForeignKey("user_table.user_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
        onupdate=text("now()"),
    )
