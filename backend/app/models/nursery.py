from sqlalchemy import Column, String, Text
from app.core.database import Base

class Nursery(Base):
    __tablename__ = "nursery"

    nursery_id = Column(String, primary_key=True, index=True)
    nursery_name = Column(String, nullable=False)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(64), nullable=True)
    notes = Column(Text, nullable=True)
