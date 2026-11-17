# Electron client

Listens for the wake word ("hey bro"), records the command, sends it to the voice server and plays music in a YouTube Music window.

## Setup

```bash
npm install
cp .env.example .env
```

In `.env`, set `VITE_CLIENT_TOKEN` to the `CLIENT_TOKEN` from `voice-server/.env`. `VITE_VOICE_SERVER_URL` defaults to the local server.

## Run

Start the voice server first (see [voice-server/README.md](../voice-server/README.md)), then:

```bash
npm start
```

- Restart after changing `.env` or `src/main.ts`; the page itself reloads on save.
- Sign in to YouTube Music in the second window once; the sign-in is kept.

## Check

```bash
npm run typecheck
npm run lint
```
