import subprocess
import tempfile
from pathlib import Path


def cut_and_concat(
    source_path: str,
    segments: list[dict],
    output_path: str,
    output_format: str = "wav",
):
    """Cut segments from source audio and concatenate in order using ffmpeg.

    segments: list of {"start_time": float, "end_time": float}
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        part_files = []

        # Cut each segment
        for i, seg in enumerate(segments):
            start = seg["start_time"]
            duration = seg["end_time"] - start
            part_path = str(Path(tmpdir) / f"part_{i:04d}.wav")

            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-ss", str(start),
                    "-t", str(duration),
                    "-i", source_path,
                    "-acodec", "pcm_s16le",
                    part_path,
                ],
                capture_output=True,
                check=True,
            )
            part_files.append(part_path)

        # Create concat list file
        list_path = str(Path(tmpdir) / "list.txt")
        with open(list_path, "w") as f:
            for p in part_files:
                f.write(f"file '{p}'\n")

        # Concat all parts
        cmd = [
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0",
            "-i", list_path,
        ]

        if output_format == "mp3":
            cmd += ["-acodec", "libmp3lame", "-q:a", "2"]
        elif output_format == "flac":
            cmd += ["-acodec", "flac"]
        else:
            cmd += ["-acodec", "pcm_s16le"]

        cmd.append(output_path)

        subprocess.run(cmd, capture_output=True, check=True)

    return output_path
