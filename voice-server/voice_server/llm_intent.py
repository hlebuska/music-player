"""LLM intent parser: transcript -> Intent, in the same shape the rule parser returns."""

from typing import Literal

from openai import AsyncOpenAI
from pydantic import BaseModel

from voice_server.intent import Intent, clean_slots, parse_reg

TIMEOUT_SECONDS = 5

INSTRUCTIONS = """\
You turn one voice command for a music player into an intent.
The text comes from speech recognition, so artist and track names may be misheard.
Write names as they are really spelled ("lincoln park" -> "linkin park").

Intents:
- play: a specific track, artist or album. query: what to search for, e.g. "numb by linkin park".
- play_radio: a genre or mood, "some" of an artist, or "something like" an artist or track.
  radio_seed: the genre, mood, artist or track, e.g. "jazz", "radiohead".
- pause, resume, next, prev, status (what's playing), like (like the current song): no slots.
- volume: level 0-100 when a number is given, otherwise direction up or down.
- none: anything that isn't a command for the player, including negated ones ("i don't like this").

Leave every slot that doesn't apply null.
"""


class LLMIntent(BaseModel):
    name: Literal[
        "play", "play_radio", "pause", "resume", "next", "prev", "volume", "status", "like", "none"
    ]
    query: str | None
    radio_seed: str | None
    direction: Literal["up", "down"] | None
    level: int | None


def to_intent(llm: LLMIntent) -> Intent | None:
    match llm.name:
        case "none":
            return None
        case "play":
            slots = {"query": llm.query} if llm.query else None
        case "play_radio":
            slots = {"radio_seed": llm.radio_seed} if llm.radio_seed else None
        case "volume":
            if llm.level is not None:
                slots = {"level": llm.level}
            elif llm.direction:
                slots = {"direction": llm.direction}
            else:
                slots = None
        case _:
            slots = {}
    if slots is None:
        return None
    return Intent(llm.name, clean_slots(llm.name, slots))


class LLMIntentParser:
    def __init__(self, model: str, api_key: str):
        self.client = AsyncOpenAI(api_key=api_key, timeout=TIMEOUT_SECONDS, max_retries=1)
        self.model = model

    async def parse(self, text: str) -> Intent | None:
        response = await self.client.responses.parse(
            model=self.model,
            instructions=INSTRUCTIONS,
            input=text,
            text_format=LLMIntent,
            reasoning={"effort": "none"},
            store=False,
        )
        parsed = response.output_parsed
        return to_intent(parsed) if parsed else None


# Instant, offline, and the LLM has nothing to add to "pause" or "volume up"
RULES_ONLY = {"pause", "resume", "next", "prev", "volume", "status", "like"}


async def understand(text: str, llm: LLMIntentParser | None) -> Intent | None:
    """Rules for fixed commands; the LLM for play requests and anything the rules miss."""
    rule_intent = parse_reg(text)
    if llm is None or (rule_intent and rule_intent.name in RULES_ONLY):
        return rule_intent
    try:
        llm_intent = await llm.parse(text)
    except Exception as e:
        print(f"llm parse failed, using rules: {e!r}")
        return rule_intent
    print(f"llm: {llm_intent}, rules: {rule_intent}")
    return llm_intent or rule_intent
