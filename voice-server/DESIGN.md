# Voice Music Player — Design

A pet project for learning: say a wake word, ask for music in English, and a server turns the phrase into a YouTube Music track that the client plays.

## Decisions

v1 is an English-only Electron client that plays YouTube Music through the user's Premium login. The client owns playback and the queue; the server turns speech into commands and keeps a read-only copy of what's playing.

| Area | Decision | Why |
|---|---|---|
| Language | English only | Smaller, faster models; rules are enough for intent |
| First client | Electron on the desktop | Fast to iterate; Chromium gives echo cancellation and a real logged-in YouTube Music |
| Second client | Raspberry Pi, later | Same protocol, different playback (mpv) |
| Music source | YouTube Music Premium | No ads, background play, no stream extraction needed in Electron |
| Who plays audio | The client, straight from YouTube | The server never touches music audio |
| Who owns playback | The client: current track, position, queue, volume. On Electron, YouTube Music's own queue runs radios | YouTube's endless radio and smooth transitions for free; the server only mirrors what the client reports (see [Playback state](#playback-state)) |
| Voice upload | One message per phrase, not streamed | Whisper reads whole clips; on a home network upload takes milliseconds |
| Trigger | Push-to-talk hotkey first, wake word second | Get the whole pipeline working before the hardest part |
| Learning | Pretrained models first, then fine-tune our own | Each stage sits behind an interface so ours can be compared with the stock one |
| Server hosting | A remote host; clients connect out to it over the internet | Works from any network with no port forwarding |
| Server stack | Python, FastAPI on uvicorn (one worker), Caddy in front for TLS | Built-in WebSockets, pydantic models for the messages, little boilerplate; the ML tools are all Python |

Out of scope for v1: Russian, multi-room sync, spoken replies (TTS), and streaming music through the server.

## Architecture

Voice goes up once per phrase, small JSON commands come back, and music never passes through the server.

## Protocol

One WebSocket per client carries everything: voice goes up as a binary message, and small JSON commands and state go both ways. The server speaks in YouTube video IDs and abstract commands, never in anything browser-specific, so the Pi client can reuse it unchanged.

| Direction | Message | Payload | Notes |
|---|---|---|---|
| Client → server | `hello` | client id, kind (electron / pi), capabilities | Sent on connect |
| Client → server | `utterance` | binary audio, 16 kHz mono (WAV or Opus) | One per spoken phrase |
| Client → server | `state` | playing / paused, videoId, position, volume | Full snapshot on connect and every ~5 s |
| Client → server | `track_changed` | videoId, title, artists, id of the `play` that caused it (if any) | On every track change, including YouTube moving on by itself |
| Client → server | `playback` | playing / paused, volume | On every change, including the knob |
| Server → client | `play` | videoId, optional playlistId | Starts a track; with playlistId the client plays it inside that radio |
| Server → client | `next` | — | Skip; the client's queue picks what comes next |
| Server → client | `pause` / `resume` / `stop` | — | |
| Server → client | `volume` | level 0–100 | |
| Server → client | `duck` | on / off | Lower music while listening |
| Server → client | `heard` | transcript, intent | For a debug overlay; optional |
| Server → client | `error` | code, message | e.g. nothing found |

Every message carries a `type` and an `id` so a reply can point back to the utterance that caused it.

Because the server is on the internet, the socket is `wss://` (TLS) and `hello` carries a per-client token; the server closes any connection without a valid one. A phrase is about 100 KB, so the upload adds well under a second on a normal home connection.

## Playback state

The client that plays the music owns playback, the way a Chromecast or a Spotify Connect speaker does; the server is a remote that sends commands and listens for state. Each fact has exactly one owner:

| Fact | Owner | Other side |
|---|---|---|
| Current track, position, playing / paused | Client | Server mirror, updated by `track_changed`, `playback` and `state` |
| Upcoming queue | Client (YouTube Music's queue; the Pi keeps its own) | Server doesn't know it |
| Volume | Client (the knob lives there) | Server mirror |
| History of what played | Server, built from `track_changed` | — |
| Current radio seed, the request behind it, intent log | Server | — |

Rules:

- The server sends commands, never state: "next", "play this in that radio", "pause", not "you are on track 7". Relative commands like `next` work even when the mirror is stale.
- The mirror is read-only: it answers `status` and feeds history, and the server never decides as if it were the truth.
- The `id` echoed in `track_changed` tells a track the server asked for apart from one YouTube moved on to by itself.
- A server restart loses nothing important: the next `state` snapshot rebuilds the mirror.
- One client is the player: for v1, the Electron client. Others (the test page, a phone remote later) only send commands.

Trade-offs accepted:

- The mirror lags by up to a second, so `status` can be briefly out of date.
- No "what's next?": the upcoming queue lives only inside YouTube's page.
- We depend on YouTube Music's web player (autoplay, URL format, `mediaSession`), as we already do by playing through it.
- `prev` is ours: the server plays the previous videoId from its history with the same playlistId, and YouTube may rebuild the radio from that track.

## Electron client

The client is a mic and a speaker: it decides when you're talking, ships the phrase, and does what the server says.

| Part | Job | Library / approach |
|---|---|---|
| Trigger | Start listening | v1: global hotkey (`globalShortcut`); v2: wake word |
| Mic capture | 16 kHz mono audio with echo cancellation on | `getUserMedia` with `echoCancellation`, `noiseSuppression`; AudioWorklet |
| VAD | Decide when the phrase ended; ~6 s timeout | `@ricky0123/vad-web` (Silero VAD in onnxruntime-web) |
| Wake word | Always-on listening | openWakeWord ONNX model in onnxruntime-web (start with a stock model such as "hey jarvis") |
| Connection | WebSocket, reconnect with backoff | Plain WebSocket in the main or renderer process |
| Player | Carry out play / next / pause / volume | Hidden window on music.youtube.com, controlled by a preload script |
| State reporter | Send `track_changed`, `playback` and `state` | `<video>` events, the videoId in the URL (`did-navigate-in-page`), title and artists from `navigator.mediaSession.metadata` |
| Ducking | Lower volume while listening | Set player volume on trigger, restore after |

Player notes:

- Start a track by navigating the hidden window to `music.youtube.com/watch?v=<id>`, or `watch?v=<id>&list=<playlistId>` to start it inside a radio that YouTube then keeps going.
- Next: seek the `<video>` to its end; YouTube Music moves to the next track in its queue on its own.
- Read track metadata from `navigator.mediaSession.metadata` rather than the page. Still to check: whether the preload's isolated context can read it; if not, the server looks the videoId up with ytmusicapi.
- Control playback through the page's `<video>` element (pause, play, currentTime) and URL navigation, never by clicking page elements, which break when YouTube changes its page.
- Google blocks sign-in inside Electron, even with a Chrome user agent. Posing as Firefox works: Firefox's user agent, and no `Sec-CH-UA` headers.
- Chromium's echo cancellation removes the music our own player window plays, but not audio from other apps: only Chromium's own output is its reference.
- Volume (later): leave YouTube Music's own volume at max and set loudness with a Web Audio gain node in the player page (`<video>` → gain → speakers). YouTube resets the `<video>` volume on every track but never touches the gain, and the knob, voice volume and ducking can all set the same gain, with smooth fades.

## Server

The server turns a phrase into a command in four stages, each behind its own interface so a stock model and our own can be swapped and compared.

| Stage | Input → output | v1 choice | Later |
|---|---|---|---|
| STT | audio → transcript | faster-whisper `small.en` on CPU, prompt seeded with artist names from the library | Our fine-tuned Whisper; Moonshine for the Pi |
| Intent parser | transcript → {intent, slots} | Rules for fixed commands (pause, next, volume…); an OpenAI model for play requests and anything the rules miss, falling back to the rules if it fails | Fine-tuned DistilBERT or small local LLM |
| Resolver | {query} → videoId; {seed} → videoId + radio playlistId | ytmusicapi search with the whole phrase ("numb linkin park"); for a radio, the top song's watch playlist (`get_watch_playlist(videoId, radio=True)`) | Seed kinds from the LLM: genre playlists, artist radio; prefer the user's library and liked songs |
| Player service | intent → commands to the client | Mirror of the client's playback, history, current radio seed; in memory | Several players |

Intents for v1:

| Intent | Example phrases |
|---|---|
| `play` | play {track}, play {track} by {artist}, play {artist} |
| `play_radio` | play some {genre or mood}, play something like {artist} |
| `pause` / `resume` | pause, stop, resume, continue |
| `next` / `prev` | next, skip, previous, go back |
| `volume` | volume up, volume down, set volume to {n} |
| `status` | what's playing |
| `like` | like this song |

Player service, still to detail:

- What `play {artist}` queues: top songs, a radio, or one track.
- What happens when nothing matches: an error message and a sound on the client.

Logging: store each utterance's audio, transcript, intent and whether it was right. This becomes the real-world test set for the study tracks.

Hosting notes:

- `small.en` on CPU needs roughly 1–2 GB of RAM; a GPU only matters for larger Whisper models or fine-tuning.
- ytmusicapi calls come from the host's datacenter IP, which YouTube may rate-limit. Playback is unaffected, because the client fetches music itself.
- Library and liked-songs lookups need ytmusicapi auth stored on the server; keep it and the logged voice clips out of the repo and off public paths.

Stack notes:

- Run one uvicorn worker. The playback mirror, history and open sockets live in memory, so several workers would each hold a different copy.
- Load the Whisper model once at startup (FastAPI lifespan), not per request.
- Transcription is CPU-heavy and blocking: run it with `asyncio.to_thread` so other sockets keep working while it runs.
- Define each protocol message as a pydantic model, with `type` as the field that tells them apart.
- Caddy gets and renews the TLS certificate on its own and passes `wss://` through to uvicorn.
- Tooling: uv for the environment, pytest for tests, ruff for linting.

## Raspberry Pi client (later)

The Pi speaks the same protocol, so the server does not change; only the client's insides do.

| Part | Electron | Pi |
|---|---|---|
| Language | TypeScript | Python |
| Wake word | openWakeWord in onnxruntime-web | openWakeWord (same ONNX model) |
| VAD | vad-web | Silero VAD |
| Player | Hidden YouTube Music window | mpv + yt-dlp, controlled over mpv's JSON IPC socket, same videoIds |
| Queue | YouTube Music's own | Its own: an mpv playlist filled from the same radio (yt-dlp on the `&list=` URL, or ytmusicapi's watch playlist) |
| Echo cancellation | Chromium built in | speexdsp / WebRTC AEC, or a mic array with AEC on board |

The Pi loses Chromium's echo cancellation, so expect the wake word to be weaker over loud music. Keep yt-dlp updated; YouTube changes break it from time to time.

## Study tracks

Three models to fine-tune, each measured against the stock model it replaces. Whisper is the main one, because artist and track names are the project's real weak spot.

| Track | What we train | Data | Measure | Hardware |
|---|---|---|---|---|
| Wake word | Small classifier on a frozen speech embedding (openWakeWord pipeline) | Thousands of Piper TTS samples of the word, mixed with noise and room echo; general speech as negatives | False accepts per hour vs. missed wake-ups, across thresholds | Laptop |
| Whisper on music commands | LoRA on whisper-small.en (transformers + peft), then convert to CTranslate2 for faster-whisper | Templates filled with our library's artists and tracks, read by Piper in many voices; a few hundred of our own recordings kept as the test set | Entity accuracy (names right), WER, and a LibriSpeech slice to catch forgetting | Free Colab GPU or Apple Silicon |
| Intent model | DistilBERT predicting intent and tagging slots together, compared with a small open LLM (0.5–3B) fine-tuned with LoRA to output JSON | Template-generated phrases plus the SNIPS PlayMusic set; real logged phrases as the test set | Intent accuracy, slot F1, latency, against the rule-based parser | CPU / Colab |

Rules for all three: the stock model is the baseline, the test set is our own logged usage, and template-generated data never goes in the test set.

## Open questions

- [ ] Server host: a CPU-only VPS, or a machine with a GPU? This sets the largest Whisper model we can run.
- [ ] What `play {artist}` should queue: top songs, a radio, or one track?
- [x] Radio continuation: the client's queue (YouTube Music's own on Electron); see [Playback state](#playback-state).
- [ ] Which wake word to train (a made-up name works best)?
- [ ] Feedback on the client: a sound on wake and on error only, or spoken replies later?
