from dataclasses import dataclass

from ytmusicapi import YTMusic


@dataclass
class Track:
    video_id: str           # what the client plays: music.youtube.com/watch?v=<video_id>
    title: str
    artists: list[str]
    album: str | None
    duration: str | None    # "3:08"


class MusicSearch:
    def __init__(self):
        # No login needed for search; library and liked songs would need auth later
        self.yt = YTMusic()

    def find_song(self, query: str) -> Track | None:
        # Blocking network call: call it from a thread, not the event loop
        results = self.yt.search(query, filter="songs", limit=5)
        for r in results:
            if r.get("videoId"):            # skip anything that can't be played
                return Track(
                    video_id=r["videoId"],
                    title=r.get("title", ""),
                    artists=[a["name"] for a in r.get("artists") or []],
                    album=(r.get("album") or {}).get("name"),
                    duration=r.get("duration"),
                )
        return None
