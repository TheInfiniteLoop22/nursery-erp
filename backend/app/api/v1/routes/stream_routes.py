import asyncio
import json

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.core.database import SessionLocal
from app.core.security import decode_token
from app.models.user import UserTable
from app.services.event_bus import bus

router = APIRouter()

HEARTBEAT_SECONDS = 15


def _authenticate(token: str) -> UserTable:
    """EventSource cannot send an Authorization header, so the JWT comes as a query param."""
    payload = decode_token(token)
    user_id = payload.get("user_id") if payload else None
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    db = SessionLocal()
    try:
        user = db.query(UserTable).filter(UserTable.user_id == user_id).first()
    finally:
        db.close()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


@router.get("/events")
async def stream_events(request: Request, token: str = Query(..., min_length=10)):
    """Server-Sent Events stream of live inventory activity (scans, order status changes)."""
    user = await asyncio.to_thread(_authenticate, token)
    queue = bus.subscribe()

    async def event_generator():
        try:
            yield _sse("ready", {"user_id": user.user_id, "role": user.role})
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
                    yield _sse(event["type"], event)
                except asyncio.TimeoutError:
                    # Comment line keeps proxies from closing an idle connection.
                    yield ": ping\n\n"
        finally:
            bus.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )
