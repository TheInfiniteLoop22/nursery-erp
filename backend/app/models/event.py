from sqlalchemy import Column, String, TIMESTAMP, text, DateTime
from app.core.database import Base

class EventTable(Base):
    __tablename__ = "event_table"

    event_id = Column(String, primary_key=True, index=True)
    event_name = Column(String, nullable=False)
    event_date = Column(String, nullable=False)  # Format: YYYY-MM-DD
    event_time = Column(String, nullable=False)  # Format: HH:MM AM/PM
    created_by = Column(String, nullable=False)
    
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()")
    )
    
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
        onupdate=text("now()")
    )
