"""Turn spelled-out numbers into digits: ["volume", "to", "fifty", "five"] -> ["volume", "to", "55"]."""

UNITS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
    "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
    "seventeen": 17, "eighteen": 18, "nineteen": 19,
}
TENS = {
    "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
    "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
}


def to_digits(words: list[str]) -> list[str]:
    out = []
    i = 0
    while i < len(words):
        value, end = read_number(words, i)
        # A lone "one" is usually a word, not a number: "no one", "the one", "one more time"
        if end > i and words[i:end] != ["one"]:
            out.append(str(value))
            i = end
        else:
            out.append(words[i])
            i += 1
    return out


def read_number(words: list[str], i: int) -> tuple[int, int]:
    """Read one number starting at words[i]. Returns (value, index after it); index == i if none."""
    value = 0
    pos = i

    # "a hundred", "one hundred", "two hundred" (and "two hundred and five")
    if pos + 1 < len(words) and words[pos + 1] == "hundred" and (
        words[pos] == "a" or 1 <= UNITS.get(words[pos], 0) <= 9
    ):
        value = UNITS.get(words[pos], 1) * 100
        pos += 2
        if pos + 1 < len(words) and words[pos] == "and" and (
            words[pos + 1] in UNITS or words[pos + 1] in TENS
        ):
            pos += 1

    # "fifty", "fifty five", or a single 0-19 word
    if pos < len(words) and words[pos] in TENS:
        value += TENS[words[pos]]
        pos += 1
        if pos < len(words) and 1 <= UNITS.get(words[pos], 0) <= 9:
            value += UNITS[words[pos]]
            pos += 1
    elif pos < len(words) and words[pos] in UNITS:
        value += UNITS[words[pos]]
        pos += 1

    return value, pos
