"""In-process realtime hub bridging sync request handlers to async WebSockets.

Route handlers run synchronously (often in a threadpool); WebSockets live on the
event loop. ``publish`` is therefore thread-safe: it schedules a queue push onto
the captured loop via ``call_soon_threadsafe``. Each connection drains its own
``asyncio.Queue``. This is single-process; a multi-worker deployment would swap
the transport for Redis pub/sub behind the same ``publish`` signature.
"""

import asyncio
from dataclasses import dataclass, field


@dataclass
class _Conn:
    queue: "asyncio.Queue"
    channels: set[str] = field(default_factory=set)
    user_id: str | None = None
    driver_id: str | None = None


class RealtimeHub:
    def __init__(self) -> None:
        self._loop: asyncio.AbstractEventLoop | None = None
        self._conns: dict[int, _Conn] = {}

    def capture_loop(self) -> None:
        try:
            self._loop = asyncio.get_running_loop()
        except RuntimeError:
            self._loop = None

    # ── connection lifecycle (called from the WS coroutine) ──────────────────
    def register(self, key: int, *, user_id=None, driver_id=None) -> "asyncio.Queue":
        if self._loop is None:
            self.capture_loop()
        conn = _Conn(queue=asyncio.Queue(), user_id=user_id, driver_id=driver_id)
        self._conns[key] = conn
        return conn.queue

    def unregister(self, key: int) -> None:
        self._conns.pop(key, None)

    def subscribe(self, key: int, channels: list[str]) -> None:
        conn = self._conns.get(key)
        if conn is not None:
            conn.channels.update(channels)

    # ── publish (safe to call from sync code / worker threads) ───────────────
    def publish(self, event: str, data: dict, *, channels=None, user_id=None) -> None:
        loop = self._loop
        if loop is None or not self._conns:
            return
        msg = {"event": event, "data": data}
        targets = [
            c for c in list(self._conns.values())
            if self._matches(c, channels, user_id)
        ]
        for conn in targets:
            loop.call_soon_threadsafe(conn.queue.put_nowait, msg)

    @staticmethod
    def _matches(conn: _Conn, channels, user_id) -> bool:
        if user_id is not None:
            # User-targeted (e.g. notification.new): deliver only to that user.
            return conn.user_id == user_id
        if channels is None:
            return True
        return bool(conn.channels.intersection(channels))


hub = RealtimeHub()
