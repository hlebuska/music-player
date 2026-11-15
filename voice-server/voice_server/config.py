import os

from dotenv import load_dotenv

load_dotenv()

TOKEN = os.environ["CLIENT_TOKEN"]          # KeyError at startup if missing, which is good: fails early
DEBUG = os.environ.get("DEBUG", "false")    # with a default; always a string
# English: ".en" models only know English. For Russian use WHISPER_MODEL=small
# (multilingual) and WHISPER_LANGUAGE=ru.
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small.en")
WHISPER_LANGUAGE = os.environ.get("WHISPER_LANGUAGE", "en")   # fixed: no auto-detect on short clips
