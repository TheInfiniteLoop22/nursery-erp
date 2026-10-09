from sqlalchemy import Column, String, TIMESTAMP, text, CheckConstraint, Numeric
from app.core.database import Base

class UserTable(Base):
    __tablename__ = "user_table"

    user_id = Column(String, primary_key=True, index=True)
    user_username = Column(String, unique=True, nullable=False, index=True)
    user_password = Column(String, nullable=False)

    # Supported application roles
    role = Column(String, nullable=False)
    hourly_rate = Column(Numeric(10, 2), nullable=False, server_default="0")
    hourly_rate_multiplier = Column(Numeric(14, 6), nullable=False, server_default="1.000000")

    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()")
    )

    __table_args__ = (
        CheckConstraint("role in ('admin', 'employee', 'nursery', 'head_installation', 'head_maintenance')", name="role_check"),
    )

