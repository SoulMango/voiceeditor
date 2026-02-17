import yt_dlp


def extract_audio(url: str, output_dir: str) -> dict:
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": f"{output_dir}/%(id)s.%(ext)s",
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "wav",
            }
        ],
        "quiet": True,
        "no_warnings": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)

    return {
        "title": info.get("title", "Unknown"),
        "duration": info.get("duration", 0),
        "video_id": info.get("id", "unknown"),
        "filename": f"{info['id']}.wav",
    }
