from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.core.deps import get_db, get_current_user
from app.models.user import UserTable
from app.models.event import EventTable
from app.schemas.event_schema import EventCreate, EventUpdate, EventResponse
from app.core.id_generator import generate_user_id

router = APIRouter()


def generate_event_id(db: Session) -> str:
    """Generate a unique event ID"""
    prefix = "EVT"
    # Get count of existing events
    count = db.query(EventTable).count()
    new_id = f"{prefix}{str(count + 1).zfill(6)}"
    
    # Ensure uniqueness
    while db.query(EventTable).filter(EventTable.event_id == new_id).first():
        count += 1
        new_id = f"{prefix}{str(count + 1).zfill(6)}"
    
    return new_id


@router.post("/create", response_model=EventResponse)
def create_event(
    payload: EventCreate,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user)
):
    """Create a new event"""
    event_id = generate_event_id(db)
    
    new_event = EventTable(
        event_id=event_id,
        event_name=payload.event_name,
        event_date=payload.event_date,
        event_time=payload.event_time,
        created_by=current_user.user_id
    )
    
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    
    return EventResponse(
        event_id=new_event.event_id,
        event_name=new_event.event_name,
        event_date=new_event.event_date,
        event_time=new_event.event_time,
        created_by=new_event.created_by,
        created_at=new_event.created_at.isoformat(),
        updated_at=new_event.updated_at.isoformat()
    )


@router.get("/all", response_model=List[EventResponse])
def get_all_events(
    limit: int = Query(500, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user)
):
    """List events (capped; use limit/offset to page)"""
    events = db.query(EventTable).order_by(EventTable.event_date.asc(), EventTable.event_id).offset(offset).limit(limit).all()
    
    return [
        EventResponse(
            event_id=event.event_id,
            event_name=event.event_name,
            event_date=event.event_date,
            event_time=event.event_time,
            created_by=event.created_by,
            created_at=event.created_at.isoformat(),
            updated_at=event.updated_at.isoformat()
        )
        for event in events
    ]


@router.get("/{event_id}", response_model=EventResponse)
def get_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user)
):
    """Get a specific event by ID"""
    event = db.query(EventTable).filter(EventTable.event_id == event_id).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return EventResponse(
        event_id=event.event_id,
        event_name=event.event_name,
        event_date=event.event_date,
        event_time=event.event_time,
        created_by=event.created_by,
        created_at=event.created_at.isoformat(),
        updated_at=event.updated_at.isoformat()
    )


@router.put("/{event_id}", response_model=EventResponse)
def update_event(
    event_id: str,
    payload: EventUpdate,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user)
):
    """Update an event"""
    event = db.query(EventTable).filter(EventTable.event_id == event_id).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if payload.event_name is not None:
        event.event_name = payload.event_name
    if payload.event_date is not None:
        event.event_date = payload.event_date
    if payload.event_time is not None:
        event.event_time = payload.event_time
    
    db.commit()
    db.refresh(event)
    
    return EventResponse(
        event_id=event.event_id,
        event_name=event.event_name,
        event_date=event.event_date,
        event_time=event.event_time,
        created_by=event.created_by,
        created_at=event.created_at.isoformat(),
        updated_at=event.updated_at.isoformat()
    )


@router.delete("/{event_id}")
def delete_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user)
):
    """Delete an event"""
    event = db.query(EventTable).filter(EventTable.event_id == event_id).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    db.delete(event)
    db.commit()
    
    return {"message": "Event deleted successfully"}
