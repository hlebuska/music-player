import io

from faster_whisper import WhisperModel


class WhisperSTT:
    def __init__(self, model_name: str, language: str | None = None):
        try:
            # Use the cached copy without asking Hugging Face (that check can hang)
            self.model = WhisperModel(
                model_name, device="cpu", compute_type="int8", local_files_only=True
            )
        except Exception:
            # Not downloaded yet: fetch it once (~500 MB for "small", no progress shown)
            print(f"downloading Whisper model {model_name!r}...")
            self.model = WhisperModel(model_name, device="cpu", compute_type="int8")
        self.language = language

    def transcribe(self, audio: bytes) -> str:
        segments, _ = self.model.transcribe(
            io.BytesIO(audio), beam_size=5, language=self.language
        )
        return " ".join(s.text.strip() for s in segments)
