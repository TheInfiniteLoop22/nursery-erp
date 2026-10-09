from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ProductNoteCreate(BaseModel):
    note_text: str

class ProductNoteUpdate(BaseModel):
    note_text: str

class ProductNoteResponse(BaseModel):
    note_id: str
    product_id: str
    admin_id: Optional[str]
    note_text: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ProductNoteWithAdmin(BaseModel):
    note_id: str
    product_id: str
    admin_id: Optional[str]
    admin_name: Optional[str]
    note_text: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
