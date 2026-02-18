import atexit
import uuid
import subprocess
import threading

import sounddevice as sd
import soundfile as sf
import numpy as np


def _get_current_output() -> str | None:
    """Get current default output device name via SwitchAudioSource."""
    try:
        result = subprocess.run(
            ["SwitchAudioSource", "-c", "-t", "output"],
            capture_output=True, text=True,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except FileNotFoundError:
        pass
    return None


def _get_available_outputs() -> list[str]:
    """List all available output device names."""
    try:
        result = subprocess.run(
            ["SwitchAudioSource", "-a", "-t", "output"],
            capture_output=True, text=True,
        )
        if result.returncode == 0:
            return [name.strip() for name in result.stdout.strip().split("\n") if name.strip()]
    except FileNotFoundError:
        pass
    return []


def _set_output(device_name: str) -> bool:
    """Set default output device via SwitchAudioSource."""
    try:
        result = subprocess.run(
            ["SwitchAudioSource", "-s", device_name, "-t", "output"],
            capture_output=True, text=True,
        )
        return result.returncode == 0
    except FileNotFoundError:
        return False


def _find_multi_output() -> str | None:
    """Find a multi-output device that includes BlackHole."""
    for name in _get_available_outputs():
        if any(kw in name.lower() for kw in ["multi-output", "다중 출력"]):
            return name
    return None


def _find_builtin_speaker() -> str | None:
    """Find built-in speaker as fallback."""
    for name in _get_available_outputs():
        if any(kw in name.lower() for kw in ["macbook", "built-in", "스피커", "speaker", "내장"]):
            # Skip multi-output or virtual devices
            if any(kw in name.lower() for kw in ["multi", "다중", "blackhole", "solstice"]):
                continue
            return name
    return None


def _restore_output(previous: str | None) -> None:
    """Restore output device, with fallback to built-in speaker."""
    if not previous:
        return

    # Check if the previous device is still available
    available = _get_available_outputs()
    if previous in available:
        _set_output(previous)
        return

    # Previous device gone (e.g. monitor disconnected) — fallback to built-in speaker
    fallback = _find_builtin_speaker()
    if fallback:
        _set_output(fallback)


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
        self._previous_output: str | None = None

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

        # Switch system output to multi-output device (speaker + BlackHole)
        self._previous_output = _get_current_output()
        multi_output = _find_multi_output()
        if multi_output:
            _set_output(multi_output)

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

        # Restore previous output device (fallback to built-in speaker if unavailable)
        _restore_output(self._previous_output)
        self._previous_output = None

        return session.output_path

    def cleanup(self):
        """Stop all recordings and restore audio output. Called on server shutdown."""
        for rid in list(self._recordings.keys()):
            try:
                self.stop(rid)
            except Exception:
                pass
        # Safety: if output is still multi-output, restore it
        current = _get_current_output()
        if current and any(kw in current.lower() for kw in ["multi-output", "다중 출력"]):
            _restore_output(self._previous_output)
            self._previous_output = None


recorder = SystemRecorder()

# Ensure audio output is restored even if the server crashes or is killed
atexit.register(recorder.cleanup)
