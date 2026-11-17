import io

from faster_whisper import WhisperModel

MAX_TOKENS = 100


class WhisperSTT:
    def __init__(
        self, model_name: str, language: str | None = None, hotwords: str | None = None
    ):
        try:
            self.model = WhisperModel(
                model_name, device="cpu", compute_type="int8", local_files_only=True
            )
        except Exception:
            print(f"downloading Whisper model {model_name!r}...")
            self.model = WhisperModel(model_name, device="cpu", compute_type="int8")
        self.language = language
        self.hotwords = hotwords

    def transcribe(self, audio: bytes) -> str:
        segments, _ = self.model.transcribe(
            io.BytesIO(audio),
            beam_size=5,
            language=self.language,
            hotwords=self.hotwords,
            vad_filter=True, 
            max_new_tokens=MAX_TOKENS,
        )
        return " ".join(s.text.strip() for s in segments)
