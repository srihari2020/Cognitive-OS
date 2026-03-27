import json
import queue
import threading
import time
from typing import Optional

from src.logger import logger

try:
    import sounddevice as sd
    from vosk import KaldiRecognizer, Model
except Exception:  # pragma: no cover - optional runtime dependency
    sd = None
    KaldiRecognizer = None
    Model = None


class WakeWordController:
    """Thread-safe wake-word signal controller."""

    def __init__(self):
        self._lock = threading.Lock()
        self._triggered = False
        self._timestamp = 0.0

    def trigger(self, source: str = "manual") -> None:
        with self._lock:
            self._triggered = True
            self._timestamp = time.time()
        logger.log_event("WAKE", f"Wake word triggered by {source}")

    def consume(self) -> dict:
        with self._lock:
            was_triggered = self._triggered
            ts = self._timestamp
            self._triggered = False
        return {"triggered": was_triggered, "timestamp": ts}

    def status(self) -> dict:
        with self._lock:
            return {"triggered": self._triggered, "timestamp": self._timestamp}


class WakeWordListener:
    """
    Lightweight continuous wake-word listener using Vosk.
    It only marks a trigger when "jarvis" appears in recognized text.
    """

    def __init__(
        self,
        controller: WakeWordController,
        model_path: str = "models/vosk-model-small-en-us-0.15",
        keyword: str = "jarvis",
        sample_rate: int = 16000,
    ):
        self.controller = controller
        self.model_path = model_path
        self.keyword = keyword.lower()
        self.sample_rate = sample_rate
        self._audio_queue: "queue.Queue[bytes]" = queue.Queue(maxsize=8)
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._stream = None

    def start(self) -> None:
        if self._running:
            return
        if not sd or not Model or not KaldiRecognizer:
            logger.log_event("WAKE", "Wake listener dependencies unavailable; skipped.")
            return
        try:
            model = Model(self.model_path)
            recognizer = KaldiRecognizer(model, self.sample_rate)
        except Exception as exc:
            logger.log_error(f"Wake listener failed to load model: {exc}")
            return

        self._running = True
        self._thread = threading.Thread(
            target=self._run_loop, args=(recognizer,), daemon=True, name="wake-word-listener"
        )
        self._thread.start()
        logger.log_event("WAKE", "Wake listener started.")

    def stop(self) -> None:
        self._running = False
        if self._stream is not None:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception:
                pass
            self._stream = None

    def _audio_callback(self, indata, frames, callback_time, status) -> None:  # pragma: no cover
        if status:
            return
        try:
            self._audio_queue.put_nowait(bytes(indata))
        except queue.Full:
            # Drop oldest frame to avoid growth / CPU spikes.
            try:
                self._audio_queue.get_nowait()
                self._audio_queue.put_nowait(bytes(indata))
            except Exception:
                pass

    def _run_loop(self, recognizer) -> None:  # pragma: no cover
        try:
            with sd.RawInputStream(
                samplerate=self.sample_rate,
                blocksize=8000,
                dtype="int16",
                channels=1,
                callback=self._audio_callback,
            ) as stream:
                self._stream = stream
                while self._running:
                    data = self._audio_queue.get(timeout=0.5)
                    if recognizer.AcceptWaveform(data):
                        result = json.loads(recognizer.Result() or "{}")
                        text = (result.get("text") or "").lower()
                        if self.keyword in text:
                            self.controller.trigger("vosk")
        except queue.Empty:
            pass
        except Exception as exc:
            logger.log_error(f"Wake listener runtime error: {exc}")
        finally:
            self._running = False
            logger.log_event("WAKE", "Wake listener stopped.")
