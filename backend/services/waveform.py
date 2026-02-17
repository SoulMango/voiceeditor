import json
from pathlib import Path

import numpy as np
import soundfile as sf


def generate_peaks(audio_path: str, peaks_per_second: int = 100) -> list[float]:
    data, sr = sf.read(audio_path, dtype="float32")
    if data.ndim > 1:
        data = data.mean(axis=1)

    samples_per_peak = max(1, sr // peaks_per_second)
    n_peaks = len(data) // samples_per_peak

    peaks = []
    for i in range(n_peaks):
        chunk = data[i * samples_per_peak : (i + 1) * samples_per_peak]
        peaks.append(round(float(np.abs(chunk).max()), 4))

    return peaks


def save_peaks(audio_path: str, output_dir: str, peaks_per_second: int = 100) -> str:
    peaks = generate_peaks(audio_path, peaks_per_second)
    audio_name = Path(audio_path).stem
    output_path = Path(output_dir) / f"{audio_name}.json"
    output_path.write_text(json.dumps(peaks))
    return str(output_path)


def get_audio_info(audio_path: str) -> dict:
    info = sf.info(audio_path)
    return {
        "duration": info.duration,
        "sample_rate": info.samplerate,
        "channels": info.channels,
    }
