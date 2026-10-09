from pydantic import BaseModel
from typing import Optional

class EventCreate(BaseModel):
    event_name: str
    event_date: str  # Format: YYYY-MM-DD or MM/DD/YYYY
    event_time: str  # Format: HH:MM AM/PM

class EventUpdate(BaseModel):
    event_name: Optional[str] = None
    event_date: Optional[str] = None
    event_time: Optional[str] = None

class EventResponse(BaseModel):
    event_id: str
    event_name: str
    event_date: str
    event_time: str
    created_by: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True
