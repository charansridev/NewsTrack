"""WebSocket endpoint for live boards.

Connect:  ws(s)://.../v1/realtime?token=<jwt>   (user OR driver JWT, validated)
Subscribe (client -> server): {"action":"subscribe","channels":["transit_board","alerts"]}
Server -> client: {"event": "...", "data": {...}}
"""

import asyncio

import jwt
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.security import decode_driver_token, decode_user_token
from app.database import get_db
from app.models.driver import Driver
from app.models.user import User
from app.realtime.hub import hub

router = APIRouter(tags=["Real-Time"])


def _identify(token: str, db: Session):
    """Return ('user', id) or ('driver', id), or None if the token is invalid."""
    try:
        p = decode_user_token(token)
        if p.get("token_use") == "user_access":
            u = db.get(User, p.get("sub"))
            if u and u.is_active:
                return ("user", u.id)
    except jwt.PyJWTError:
        pass
    try:
        p = decode_driver_token(token)
        if p.get("token_use") == "driver_access" and p.get("driver"):
            d = db.get(Driver, p.get("driver_id"))
            if d:
                return ("driver", d.driver_id)
    except jwt.PyJWTError:
        pass
    return None


@router.websocket("/realtime")
async def realtime(ws: WebSocket, token: str = Query(...), db: Session = Depends(get_db)):
    identity = _identify(token, db)
    if identity is None:
        await ws.close(code=4401)  # JWT validated on connect
        return

    kind, ident = identity
    await ws.accept()
    key = id(ws)
    queue = hub.register(
        key,
        user_id=ident if kind == "user" else None,
        driver_id=ident if kind == "driver" else None,
    )

    async def receiver():
        while True:
            msg = await ws.receive_json()
            if msg.get("action") == "subscribe":
                hub.subscribe(key, list(msg.get("channels", [])))
                await ws.send_json({"event": "subscribed", "data": {"channels": msg.get("channels", [])}})

    async def sender():
        while True:
            out = await queue.get()
            await ws.send_json(out)

    recv_task = asyncio.create_task(receiver())
    send_task = asyncio.create_task(sender())
    try:
        await asyncio.gather(recv_task, send_task)
    except WebSocketDisconnect:
        pass
    finally:
        recv_task.cancel()
        send_task.cancel()
        hub.unregister(key)
