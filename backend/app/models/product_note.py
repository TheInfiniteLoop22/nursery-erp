from sqlalchemy import Column, String, ForeignKey, DateTime, func
from datetime import datetime
from app.core.database import Base
from app.core.id_generator import generate_uuid

class ProductNote(Base):
    __tablename__ = "product_note"

    note_id = Column(String, primary_key=True, default=generate_uuid, index=True)
    
    product_id = Column(
        String,
        ForeignKey("product.product_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    admin_id = Column(
        String,
        ForeignKey("user_table.user_id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    
    note_text = Column(String, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
