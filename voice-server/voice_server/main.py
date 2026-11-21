import asyncio
import time
import traceback
from contextlib import asynccontextmanager
from dataclasses import asdict
from pathlib import Path

from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse

from voice_server.auth import authenticated_hello
from voice_server.config import (
    DEBUG,
    OPENAI_API_KEY,
    OPENAI_MODEL,
    TOKEN,
    WHISPER_LANGUAGE,
    WHISPER_MODEL,
)
from voice_server.controller import Controller, error
from voice_server.intent import COMMAND_HOTWORDS
from voice_server.llm_intent import LLMIntentParser, understand
from voice_server.search import MusicSearch
from voice_server.stt import WhisperSTT

TEST_PAGE = Path(__file__).parent / "test_page.html"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once at startup: load the Whisper model, so no utterance pays for it
    app.state.stt = WhisperSTT(WHISPER_MODEL, WHISPER_LANGUAGE, COMMAND_HOTWORDS)
    app.state.controller = Controller(MusicSearch())
    app.state.llm = LLMIntentParser(OPENAI_MODEL, OPENAI_API_KEY) if OPENAI_API_KEY else None
    yield                    # server runs here


app = FastAPI(lifespan=lifespan)   # ← this is the "app" in voice_server.main:app


@app.get("/")
async def get():
    default_token = TOKEN if DEBUG == "true" else ""
    html = TEST_PAGE.read_text()   # read on every request, so edits show up on refresh
    return HTMLResponse(html.replace("__DEFAULT_TOKEN__", default_token))


@app.get("/health")
def health():
    return {"ok": True}


@app.websocket("/ws")
async def ws(websocket: WebSocket, hello: dict = Depends(authenticated_hello)):
    print(f"client connected: {hello.get('client_id')}")

    try:
        while True:                           # one iteration per incoming message
            audio = await websocket.receive_bytes()
            try:
                await handle_utterance(websocket, audio)
            except WebSocketDisconnect:
                raise
            except Exception:
                # A bug in one utterance must not drop the connection
                traceback.print_exc()
                await websocket.send_json(error("internal", "something went wrong"))
    except WebSocketDisconnect:
        print(f"client left: {hello.get('client_id')}")


async def handle_utterance(websocket: WebSocket, audio: bytes):
    start = time.perf_counter()
    print(f"got utterance: {len(audio)} bytes")
    try:
        await respond(websocket, audio)
    finally:
        print(f"utterance took {time.perf_counter() - start:.2f}s")


async def respond(websocket: WebSocket, audio: bytes):
    try:
        text = await asyncio.to_thread(websocket.app.state.stt.transcribe, audio)
    except Exception as e:
        print(f"transcription failed: {e!r}")
        await websocket.send_json(error("bad_audio", "couldn't decode the audio clip"))
        return
    print(f"heard: {text!r}")

    intent = await understand(text, websocket.app.state.llm)
    print(f"intent: {intent}")
    if intent is None:
        await websocket.send_json(error("not_understood", f"didn't understand intent: {text!r}"))
        return

    # Tell the client what we understood, then what to do about it
    await websocket.send_json({"type": "heard", "transcript": text, "intent": asdict(intent)})

    command = await websocket.app.state.controller.handle(intent)
    print(f"command: {command}")
    await websocket.send_json(command)
