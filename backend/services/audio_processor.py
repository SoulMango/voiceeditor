from pydub import AudioSegment
from pathlib import Path


def cut_and_concat(
    source_path: str,
    segments: list[dict],
    output_path: str,
    output_format: str = "wav",
):
    """Cut segments from source audio and concatenate in order.

    segments: list of {"start_time": float, "end_time": float}
    """
    audio = AudioSegment.from_file(source_path)
    combined = AudioSegment.empty()

    for seg in segments:
        start_ms = int(seg["start_time"] * 1000)
        end_ms = int(seg["end_time"] * 1000)
        combined += audio[start_ms:end_ms]

    combined.export(output_path, format=output_format)
    return output_path
