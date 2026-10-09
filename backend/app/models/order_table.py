import enum
from sqlalchemy import Column, String, ForeignKey, Numeric, TIMESTAMP, text, Enum
from app.core.database import Base

class OrderStatus(str, enum.Enum):
    CREATED = "CREATED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"

class OrderTable(Base):
    __tablename__ = "order_table"

    order_id = Column(String, primary_key=True, index=True)

    user_id = Column(
        String,
        ForeignKey("user_table.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    client_name = Column(String, nullable=False)

    work_order_type = Column(
        String(20),
        nullable=False,
        server_default="INSTALL",
    )

    designer_name = Column(String(50), nullable=True)

    total_order_amount = Column(Numeric(14, 2), nullable=False, default=0)

    status = Column(
        Enum(OrderStatus, name="order_status_enum", create_type=True, metadata=Base.metadata),
        nullable=False,
        server_default="CREATED"
    )

    ordered_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()")
    )

    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()")
    )

    invoice_generated_at = Column(TIMESTAMP(timezone=True), nullable=True)
    paid_at = Column(TIMESTAMP(timezone=True), nullable=True)
