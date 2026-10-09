"""Tiny in-process limiter for failed logins.

Counts failures per (client IP, username) in a sliding window; successful logins are never counted,
so normal use is unaffected. State is per process, which matches the single-worker deployment.
Swap the dict for Redis/Key Value if the API ever runs more than one worker.
"""

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

MAX_FAILURES = 5
WINDOW_SECONDS = 300


class FailedLoginLimiter:
    def __init__(self, max_failures: int = MAX_FAILURES, window: int = WINDOW_SECONDS):
        self.max_failures = max_failures
        self.window = window
        self._failures: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> deque[float]:
        hits = self._failures[key]
        while hits and now - hits[0] > self.window:
            hits.popleft()
        if not hits:
            self._failures.pop(key, None)
        return hits

    def check(self, key: str) -> None:
        """Raise 429 if the key has used up its failures."""
        now = time.monotonic()
        with self._lock:
            hits = self._prune(key, now)
            if len(hits) >= self.max_failures:
                retry_after = max(1, int(self.window - (now - hits[0])))
                raise HTTPException(
                    status_code=429,
                    detail="Too many failed login attempts. Try again later.",
                    headers={"Retry-After": str(retry_after)},
                )

    def record_failure(self, key: str) -> None:
        with self._lock:
            self._failures[key].append(time.monotonic())

    def reset(self, key: str | None = None) -> None:
        with self._lock:
            if key is None:
                self._failures.clear()
            else:
                self._failures.pop(key, None)


login_limiter = FailedLoginLimiter()


def client_key(request: Request, username: str) -> str:
    # Render terminates TLS in front of the app, so the real client is the first X-Forwarded-For entry.
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")
    return f"{ip}|{username.lower()}"
