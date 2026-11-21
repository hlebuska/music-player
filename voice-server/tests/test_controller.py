import asyncio

from voice_server.controller import Controller
from voice_server.intent import Intent


class FailingSearch:
    def find_song(self, query: str):
        raise ConnectionError("network is down")


def test_search_failure_returns_error():
    controller = Controller(FailingSearch())  # pyright: ignore[reportArgumentType]
    reply = asyncio.run(controller.handle(Intent("play", {"query": "numb"})))
    assert reply["type"] == "error"
    assert reply["code"] == "search_failed"
    assert controller.current is None
