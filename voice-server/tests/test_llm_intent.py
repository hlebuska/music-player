import asyncio

from voice_server.intent import Intent
from voice_server.llm_intent import LLMIntent, to_intent, understand


def llm(name, query=None, radio_seed=None, direction=None, level=None):
    return LLMIntent(name=name, query=query, radio_seed=radio_seed, direction=direction, level=level)


class FakeLLM:
    def __init__(self, reply=None, fail=False):
        self.reply = reply
        self.fail = fail
        self.calls = []

    async def parse(self, text):
        self.calls.append(text)
        if self.fail:
            raise TimeoutError("slow")
        return self.reply


def run(text, fake):
    return asyncio.run(understand(text, fake))  # pyright: ignore[reportArgumentType]


def test_play_splits_track_and_artist_like_the_rules():
    assert to_intent(llm("play", query="numb by linkin park")) == Intent(
        "play", {"query": "numb by linkin park", "track": "numb", "artist": "linkin park"}
    )


def test_radio_keeps_seed():
    assert to_intent(llm("play_radio", radio_seed="jazz")) == Intent("play_radio", {"radio_seed": "jazz"})


def test_volume_prefers_level_and_clamps():
    assert to_intent(llm("volume", level=150, direction="up")) == Intent("volume", {"level": 100})
    assert to_intent(llm("volume", direction="down")) == Intent("volume", {"direction": "down"})


def test_missing_slot_or_none_is_not_understood():
    assert to_intent(llm("play")) is None
    assert to_intent(llm("volume")) is None
    assert to_intent(llm("none")) is None


def test_fixed_commands_skip_the_llm():
    fake = FakeLLM(Intent("play", {"query": "x"}))
    assert run("pause", fake) == Intent("pause")
    assert fake.calls == []


def test_play_goes_to_the_llm():
    fake = FakeLLM(Intent("play_radio", {"radio_seed": "jazz"}))
    assert run("play jazz", fake) == Intent("play_radio", {"radio_seed": "jazz"})
    assert fake.calls == ["play jazz"]


def test_unmatched_phrase_goes_to_the_llm():
    fake = FakeLLM(Intent("play_radio", {"radio_seed": "jazz"}))
    assert run("i'm in the mood for jazz", fake) == Intent("play_radio", {"radio_seed": "jazz"})


def test_llm_failure_falls_back_to_rules():
    assert run("play numb", FakeLLM(fail=True)) == Intent("play", {"query": "numb"})


def test_llm_not_understood_falls_back_to_rules():
    assert run("play numb", FakeLLM(None)) == Intent("play", {"query": "numb"})


def test_no_llm_means_rules_only():
    assert run("play numb", None) == Intent("play", {"query": "numb"})
