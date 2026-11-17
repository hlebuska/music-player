# Voice server

Turns a spoken phrase into a music command: Whisper transcribes it, rules parse the intent, ytmusicapi finds the track. Design: [DESIGN.md](DESIGN.md).

## Setup

Needs [uv](https://docs.astral.sh/uv/).

```bash
uv sync
```

Create `.env`:

```
CLIENT_TOKEN=any-long-random-string
DEBUG=true
```

- `CLIENT_TOKEN`: clients must send it in their `hello`. Put the same value in `electron-client/.env`.
- `DEBUG=true` prefills the token on the test page.
- Optional: `WHISPER_MODEL` (default `small.en`), `WHISPER_LANGUAGE` (default `en`).

## Run

```bash
uv run uvicorn voice_server.main:app --port 8000
```

- WebSocket: `ws://localhost:8000/ws`
- Test page (send a file or record from the browser): http://localhost:8000/
- The first start downloads the Whisper model.

## Test

```bash
uv run pytest
```
