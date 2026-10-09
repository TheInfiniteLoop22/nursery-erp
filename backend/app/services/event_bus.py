"""In-process pub/sub used to push inventory events to browsers over SSE.

Route handlers that mutate stock (scans, order status changes) call
``publish``; every connected ``/stream/events`` client receives the event
immediately. Handlers run in FastAPI's worker threadpool while subscribers
live on the event loop, so publishing hops threads with
``loop.call_soon_threadsafe``.

This is deliberately single-process: run uvicorn with one worker
(``WEB_CONCURRENCY=1``, the default here). For multiple workers or instances,
swap this class for Postgres LISTEN/NOTIFY or Redis pub/sub with the same
``subscribe`` / ``publish`` interface.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

log = logging.getLogger("uvicorn.error")

# A slow client must not be able to grow memory without bound.
_QUEUE_MAX = 200


class EventBus:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        # Called from the event loop (the SSE endpoint), so it is safe to capture it here.
        self._loop = asyncio.get_running_loop()
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=_QUEUE_MAX)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        self._subscribers.discard(queue)

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

    def publish(self, event_type: str, payload: dict[str, Any]) -> None:
        """Thread-safe, non-blocking. A no-op when nobody is listening."""
        loop = self._loop
        if loop is None or not self._subscribers:
            return
        event = {
            "type": event_type,
            "at": datetime.now(timezone.utc).isoformat(),
            **payload,
        }
        for queue in list(self._subscribers):
            loop.call_soon_threadsafe(self._offer, queue, event)

    @staticmethod
    def _offer(queue: asyncio.Queue[dict[str, Any]], event: dict[str, Any]) -> None:
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            log.warning("SSE client queue full; dropping event %s", event.get("type"))


bus = EventBus()
