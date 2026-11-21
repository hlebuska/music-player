import random
from collections import Counter

from voice_server.search import MusicSearch, normalize


def song(video_id, title, artist):
    return {"videoId": video_id, "title": title, "artists": [{"name": artist}]}


class FakeYT:
    def __init__(self, results):
        self.results = results

    def search(self, query, filter, limit):
        return self.results


def searcher(results, seed=0):
    search = MusicSearch(random.Random(seed))
    search.yt = FakeYT(results)  # pyright: ignore[reportAttributeAccessIssue]
    return search


RADIOHEAD = [song(f"rh{i}", f"song {i}", "Radiohead") for i in range(12)]


def test_normalize_ignores_case_the_and_punctuation():
    assert normalize("The Beatles") == normalize("beatles")
    assert normalize("AC/DC") == "acdc"


def test_artist_request_varies_but_favours_top_songs():
    search = searcher(RADIOHEAD)
    picks = Counter(search.find_song("radiohead").video_id for _ in range(1000))  # pyright: ignore[reportOptionalMemberAccess]
    assert len(picks) > 3
    assert picks.most_common(1)[0][0] == "rh0"
    assert set(picks) <= {f"rh{i}" for i in range(10)}


def test_artist_request_skips_other_artists():
    results = [song("a", "creep", "Radiohead"), song("b", "creep cover", "Someone Else")]
    search = searcher(results)
    assert {search.find_song("Radiohead").video_id for _ in range(50)} == {"a"}  # pyright: ignore[reportOptionalMemberAccess]


def test_track_request_always_plays_the_top_result():
    results = [song("numb", "Numb", "Linkin Park"), song("other", "In the End", "Linkin Park")]
    search = searcher(results)
    assert {search.find_song("numb by linkin park").video_id for _ in range(50)} == {"numb"}  # pyright: ignore[reportOptionalMemberAccess]


def test_nothing_playable_returns_none():
    assert searcher([{"title": "no id"}]).find_song("x") is None
