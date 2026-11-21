import random
import re
from dataclasses import dataclass

from ytmusicapi import YTMusic

SEARCH_LIMIT = 20
ARTIST_PICKS = 10       # how deep into an artist's songs a random pick can reach


@dataclass
class Track:
    video_id: str           # what the client plays: music.youtube.com/watch?v=<video_id>
    title: str
    artists: list[str]
    album: str | None
    duration: str | None    # "3:08"


def normalize(name: str) -> str:
    """'The Beatles' -> 'beatles', 'AC/DC' -> 'acdc'"""
    return re.sub(r"[^a-z0-9]", "", re.sub(r"^the ", "", name.lower().strip()))


def is_by(query: str, result: dict) -> bool:
    return normalize(query) in {normalize(a["name"]) for a in result.get("artists") or []}


def weighted_pick(items: list, rng: random.Random):
    # Rank 1 is the most likely pick (about a third of the time over 10 songs), lower ranks less so
    return rng.choices(items, weights=[1 / (rank + 1) for rank in range(len(items))])[0]


class MusicSearch:
    def __init__(self, rng: random.Random | None = None):
        # No login needed for search; library and liked songs would need auth later
        self.yt = YTMusic()
        self.rng = rng or random.Random()

    def find_song(self, query: str) -> Track | None:
        # Blocking network call: call it from a thread, not the event loop
        results = self.yt.search(query, filter="songs", limit=SEARCH_LIMIT)
        playable = [r for r in results if r.get("videoId")]
        if not playable:
            return None
        if is_by(query, playable[0]):
            # Just an artist ("play radiohead"): one of their songs, not always the top one
            songs = [r for r in playable if is_by(query, r)][:ARTIST_PICKS]
            return to_track(weighted_pick(songs, self.rng))
        return to_track(playable[0])


def to_track(r: dict) -> Track:
    return Track(
        video_id=r["videoId"],
        title=r.get("title", ""),
        artists=[a["name"] for a in r.get("artists") or []],
        album=(r.get("album") or {}).get("name"),
        duration=r.get("duration"),
    )
