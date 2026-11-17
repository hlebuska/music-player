"""Rule-based intent parser: transcript -> Intent (name + slots), or None if not understood."""

import re
from dataclasses import dataclass, field

from voice_server.numbers import to_digits


@dataclass
class Intent:
    name: str                                   # play, play_radio, pause, resume, next, prev, volume, status, like
    slots: dict = field(default_factory=dict)   # e.g. {"query": "numb by linkin park"}


# Words people put around a command that carry no meaning
LEADING_FILLER = re.compile(r"^(hey|ok|okay|um|uh|so|just|please|can you|could you|would you)\s+")
TRAILING_FILLER = re.compile(r"\s+(please|now|thanks|thank you)$")


def normalize(text: str) -> str:
    """'Hey, can you play Numb, please?' -> 'play numb'"""
    text = text.lower().replace("’", "'")         # Whisper sometimes writes curly apostrophes
    text = re.sub(r"[^\w\s']", " ", text)          # punctuation -> space; keep ' for "what's"
    text = re.sub(r"\s+", " ", text).strip()
    # Strip filler repeatedly: "hey can you just play x" has several in a row
    while True:
        stripped = TRAILING_FILLER.sub("", LEADING_FILLER.sub("", text))
        if stripped == text:
            return text
        text = stripped


# Every way of saying "play": "turn on future", "put on some jazz", "listen to numb"
PLAY = r"(play|put on|turn on|start playing|listen to|i want to hear|let me hear)( me)?"

# Ordered: the first rule that matches wins, so specific rules go before general ones.
# Each rule: (pattern, intent name, fixed slots). Named groups (?P<name>...) become slots.
RULES = [
    # Radio before plain "play", or "play something like x" would search for that phrase
    (rf"{PLAY} (something|music|songs?) like (?P<seed>.+)", "play_radio", {}),
    (rf"{PLAY} some (?P<seed>.+)", "play_radio", {}),
    # Bare "play" means resume, so it goes before "play {query}"
    (r"(resume|continue|unpause|play)( the music| it)?", "resume", {}),
    (rf"{PLAY} (?P<query>.+)", "play", {}),
    (r"(pause|stop)( the music| it| this)?", "pause", {}),
    (r"(next|skip)( song| track| this| this song| it)?", "next", {}),
    (r"(previous|go back|back)( song| track)?", "prev", {}),
    (r"(volume up|turn (it|the volume|the music) up|louder)", "volume", {"direction": "up"}),
    (r"(volume down|turn (it|the volume|the music) down|quieter)", "volume", {"direction": "down"}),
    (r"(set )?(the )?volume (to )?(?P<level>\d+)( percent)?", "volume", {}),
    (r"what('s| is) (playing|this|this song|that song)", "status", {}),
    (r"(i )?like (this|this song|it)", "like", {}),
]

COMMAND_HOTWORDS = (
    "Play. Pause. Resume. Continue. Stop. Next. Skip. Previous. Go back. "
    "Volume up. Volume down. Louder. Quieter. Set volume to 50. "
    "What's playing? Like this song."
)

# fullmatch: the pattern must cover the whole phrase, so "play" inside "display" never counts
COMPILED = [(re.compile(pattern), name, fixed) for pattern, name, fixed in RULES]


# If any of these come before the command, it's not a command: "i don't like this" is not "like"
NEGATION = {"don't", "dont", "do", "not", "no", "never"}


def parse(text: str) -> Intent | None:
    # The command may not be at the start: "hey bruh hey bruh play play weekend".
    # Try the whole phrase first, then drop leading words one at a time until a rule matches.
    # Numbers as digits, so rules only need \d+: "volume to five" -> "volume to 5"
    words = to_digits(normalize(text).split())
    for start in range(len(words)):
        if NEGATION & set(words[:start]):
            return None
        # Collapse a stuttered first word: "play play weekend" -> "play weekend"
        phrase = re.sub(r"^(\S+)(?: \1\b)+", r"\1", " ".join(words[start:]))
        intent = match_rules(phrase)
        if intent:
            return intent
    return None


def match_rules(phrase: str) -> Intent | None:
    for pattern, name, fixed in COMPILED:
        match = pattern.fullmatch(phrase)
        if match:
            slots = {**fixed, **{k: v for k, v in match.groupdict().items() if v is not None}}
            return Intent(name, clean_slots(name, slots))
    return None


def clean_slots(name: str, slots: dict) -> dict:
    if name == "play":
        # Keep the whole query (the resolver searches with it), and also split
        # "track by artist" when present. rsplit: "stand by me by ben e king" -> last " by "
        track, sep, artist = slots["query"].rpartition(" by ")
        if sep and track and artist:
            slots["track"] = track
            slots["artist"] = artist
    if name == "volume" and "level" in slots:
        slots["level"] = max(0, min(100, int(slots["level"])))
    return slots
