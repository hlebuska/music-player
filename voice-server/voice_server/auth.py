import asyncio
import json
import secrets

from fastapi import WebSocket, WebSocketDisconnect, WebSocketException, status

from voice_server.config import TOKEN


def reject(reason: str) -> WebSocketException:
    return WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=reason)


async def authenticated_hello(websocket: WebSocket) -> dict:
    """Runs before the /ws endpoint: accept, wait for hello, check the token.

    Returns the hello message. On any problem it raises, the socket is closed
    and the endpoint never runs.
    """
    await websocket.accept()                

    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=5)
        hello = json.loads(raw)
    except WebSocketDisconnect:
        raise WebSocketException(code=status.WS_1000_NORMAL_CLOSURE)
    except asyncio.TimeoutError:
        raise reject("no hello within 5s")
    except ValueError:
        raise reject("invalid message")     

    if not isinstance(hello, dict):
        raise reject("invalid message")
    if hello.get("type") != "hello":
        raise reject("first message must be hello")
    if not secrets.compare_digest(str(hello.get("token", "")), TOKEN):
        raise reject("invalid token")

    return hello
