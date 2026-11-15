import asyncio
import json
import secrets

from fastapi import WebSocket, WebSocketDisconnect, WebSocketException, status

from voice_server.config import TOKEN


def reject(reason: str) -> WebSocketException:
    # Raising this from a dependency makes FastAPI close the socket with this code and reason
    return WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=reason)


async def authenticated_hello(websocket: WebSocket) -> dict:
    """Runs before the /ws endpoint: accept, wait for hello, check the token.

    Returns the hello message. On any problem it raises, the socket is closed
    and the endpoint never runs.
    """
    await websocket.accept()                  # finish the handshake

    # 1. Wait for hello, at most 5 seconds
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=5)
        hello = json.loads(raw)
    except WebSocketDisconnect:
        # Client left before saying hello. Turn it into a close so uvicorn
        # doesn't log it as a crash ("Exception in ASGI application").
        raise WebSocketException(code=status.WS_1000_NORMAL_CLOSURE)
    except asyncio.TimeoutError:
        raise reject("no hello within 5s")
    except ValueError:
        raise reject("invalid message")       # not JSON

    # 2. Check it is a hello with the right token
    if not isinstance(hello, dict):
        raise reject("invalid message")
    if hello.get("type") != "hello":
        raise reject("first message must be hello")
    if not secrets.compare_digest(str(hello.get("token", "")), TOKEN):
        raise reject("invalid token")

    return hello
