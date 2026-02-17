import uuid
import threading

import sounddevice as sd
import soundfile as sf
import numpy as np


class RecordingSession:
    def __init__(self, output_path: str, samplerate: int, channels: int, device: int):
        self.output_path = output_path
        self.samplerate = samplerate
        self.channels = channels
        self.device = device
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self):
        self._thread = threading.Thread(target=self._record, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)

    def _record(self):
        with sf.SoundFile(
            self.output_path,
            mode="w",
            samplerate=self.samplerate,
            channels=self.channels,
            format="WAV",
            subtype="PCM_16",
        ) as f:
            def callback(indata, frames, time_info, status):
                if not self._stop_event.is_set():
                    f.write(indata.copy())

            with sd.InputStream(
                samplerate=self.samplerate,
                channels=self.channels,
                device=self.device,
                callback=callback,
                blocksize=1024,
            ):
                self._stop_event.wait()


class SystemRecorder:
    def __init__(self):
        self._recordings: dict[str, RecordingSession] = {}

    def find_device(self, name: str = "BlackHole") -> int:
        devices = sd.query_devices()
        for i, d in enumerate(devices):
            if name.lower() in d["name"].lower() and d["max_input_channels"] > 0:
                return i
        raise RuntimeError(
            f"Audio device '{name}' not found. "
            "Make sure BlackHole is installed. "
            "Available devices: " + ", ".join(d["name"] for d in devices)
        )

    def start(self, output_path: str, device_name: str = "BlackHole 16ch") -> str:
        device_idx = self.find_device(device_name)
        device_info = sd.query_devices(device_idx)
        samplerate = int(device_info["default_samplerate"])
        channels = min(2, int(device_info["max_input_channels"]))

        recording_id = str(uuid.uuid4())
        session = RecordingSession(output_path, samplerate, channels, device_idx)
        session.start()
        self._recordings[recording_id] = session
        return recording_id

    def stop(self, recording_id: str) -> str:
        session = self._recordings.pop(recording_id, None)
        if not session:
            raise ValueError(f"Recording {recording_id} not found")
        session.stop()
        return session.output_path


recorder = SystemRecorder()
