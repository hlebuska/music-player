import asyncio
from dataclasses import asdict

from voice_server.intent import Intent
from voice_server.search import MusicSearch, Track

VOLUME_STEP = 10


def error(code: str, message: str) -> dict:
    return {"type": "error", "code": code, "message": message}


class Controller:
    """Takes an intent, updates the player state, returns the command to send to the client.

    One instance for the whole server, holding the state (current track, playing
    or paused, volume) in memory, so every client shares it. Separate state per
    client would need session tracking and a persistent store to keep it in.
    """

    def __init__(self, search: MusicSearch):
        self.search = search
        self.current: Track | None = None
        self.playing = False
        self.volume = 50

    async def handle(self, intent: Intent) -> dict:
        match intent.name:
            case "play" | "play_radio":
                return await self.play(intent.slots.get("query") or intent.slots.get("seed"))
            case "pause":
                return self.pause()
            case "resume":
                return self.resume()
            case "volume":
                return self.set_volume(intent.slots)
            case "status":
                return self.status()
            case _:
                # next, prev: need a queue (open question: YouTube's autoplay or our own)
                # like: needs a logged-in ytmusicapi
                return error("not_supported", f"{intent.name!r} isn't supported yet")

    async def play(self, query: str | None) -> dict:
        if not query:
            return error("not_understood", "what should I play?")
        # Blocking network call: run it in a thread so other sockets keep working
        track = await asyncio.to_thread(self.search.find_song, query)
        if track is None:
            return error("not_found", f"nothing found for {query!r}")
        self.current = track
        self.playing = True
        return {"type": "play", "videoId": track.video_id, "track": asdict(track)}

    def pause(self) -> dict:
        if self.current is None:
            return error("nothing_playing", "nothing to pause")
        self.playing = False
        return {"type": "pause"}

    def resume(self) -> dict:
        if self.current is None:
            return error("nothing_playing", "nothing to resume")
        self.playing = True
        return {"type": "resume"}

    def set_volume(self, slots: dict) -> dict:
        if "level" in slots:
            level = slots["level"]
        elif slots.get("direction") == "up":
            level = self.volume + VOLUME_STEP
        else:
            level = self.volume - VOLUME_STEP
        self.volume = max(0, min(100, level))
        return {"type": "volume", "level": self.volume}

    def status(self) -> dict:
        return {
            "type": "status",
            "playing": self.playing,
            "volume": self.volume,
            "track": asdict(self.current) if self.current else None,
        }
