import os

from dotenv import load_dotenv

load_dotenv()

TOKEN = os.environ["CLIENT_TOKEN"]     
DEBUG = os.environ.get("DEBUG", "false") 
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small.en")
WHISPER_LANGUAGE = os.environ.get("WHISPER_LANGUAGE", "en")  
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")   # unset: rules only
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-6-luna")
