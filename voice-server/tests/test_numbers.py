import pytest

from voice_server.intent import parse
from voice_server.numbers import to_digits


@pytest.mark.parametrize(
    "text, expected",
    [
        ("volume to five", "volume to 5"),
        ("volume to fifty five", "volume to 55"),
        ("volume to twenty", "volume to 20"),
        ("volume to fifteen", "volume to 15"),
        ("volume to a hundred", "volume to 100"),
        ("volume to one hundred", "volume to 100"),
        ("two hundred and five", "205"),
        ("skip twenty seconds", "skip 20 seconds"),
        ("volume to 50", "volume to 50"),                 # digits stay as they are
        ("twenty one pilots", "21 pilots"),               # "one" inside a number converts
        ("play no one by alicia keys", "play no one by alicia keys"),  # lone "one" stays
        ("play the one", "play the one"),
        ("play a song", "play a song"),                   # "a" only counts before "hundred"
        ("five five", "5 5"),                             # two numbers, not ten
    ],
)
def test_to_digits(text, expected):
    assert " ".join(to_digits(text.split())) == expected


@pytest.mark.parametrize(
    "text, level",
    [
        ("Volume to five.", 5),
        ("Set the volume to fifty-five percent", 55),
        ("volume to 30", 30),
        ("volume to a hundred", 100),
    ],
)
def test_volume_words(text, level):
    intent = parse(text)
    assert intent is not None
    assert intent.name == "volume"
    assert intent.slots["level"] == level
