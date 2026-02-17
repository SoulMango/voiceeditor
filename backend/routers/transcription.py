import json
import uuid
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import PROJECTS_DIR
from models.database import AudioFile, get_db
from models.schemas import TranscriptionStartRequest

router = APIRouter(prefix="/api/transcription", tags=["transcription"])


def _transcribe_sync(audio_path: str, language: str | None, model_size: str) -> dict:
    from faster_whisper import WhisperModel

    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        audio_path,
        word_timestamps=True,
        language=language,
    )

    result_segments = []
    for segment in segments:
        words = []
        for word in (segment.words or []):
            words.append({
                "start": round(word.start, 3),
                "end": round(word.end, 3),
                "word": word.word.strip(),
                "probability": round(word.probability, 3),
            })
        result_segments.append({
            "start": round(segment.start, 3),
            "end": round(segment.end, 3),
            "text": segment.text.strip(),
            "words": words,
        })

    return {
        "language": info.language,
        "segments": result_segments,
    }


@router.post("/start")
async def start_transcription(req: TranscriptionStartRequest, db: AsyncSession = Depends(get_db)):
    from tasks.background import task_manager

    result = await db.execute(select(AudioFile).where(AudioFile.id == req.audio_id))
    audio = result.scalar_one_or_none()
    if not audio:
        raise HTTPException(404, "Audio not found")

    audio_path = str(PROJECTS_DIR / audio.project_id / "original" / audio.filename)
    task = task_manager.create_task()

    async def do_transcribe():
        transcript = await task_manager.run_in_thread(
            _transcribe_sync, audio_path, req.language, req.model_size
        )

        transcript_data = {"audio_id": req.audio_id, **transcript}
        transcript_path = PROJECTS_DIR / audio.project_id / "transcripts" / f"{req.audio_id}.json"
        transcript_path.parent.mkdir(parents=True, exist_ok=True)
        transcript_path.write_text(json.dumps(transcript_data, ensure_ascii=False, indent=2))

        audio.has_transcript = True
        async with db.begin():
            db.add(audio)

        return {"audio_id": req.audio_id}

    task_manager.run_in_background(task, do_transcribe())
    return {"task_id": task.id}


@router.get("/{audio_id}")
async def get_transcription(audio_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AudioFile).where(AudioFile.id == audio_id))
    audio = result.scalar_one_or_none()
    if not audio:
        raise HTTPException(404, "Audio not found")

    transcript_path = PROJECTS_DIR / audio.project_id / "transcripts" / f"{audio_id}.json"
    if not transcript_path.exists():
        raise HTTPException(404, "Transcript not found")

    return json.loads(transcript_path.read_text())


@router.put("/{audio_id}")
async def update_transcription(audio_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    """Update a specific segment's text in the transcript."""
    result = await db.execute(select(AudioFile).where(AudioFile.id == audio_id))
    audio = result.scalar_one_or_none()
    if not audio:
        raise HTTPException(404, "Audio not found")

    transcript_path = PROJECTS_DIR / audio.project_id / "transcripts" / f"{audio_id}.json"
    if not transcript_path.exists():
        raise HTTPException(404, "Transcript not found")

    data = json.loads(transcript_path.read_text())

    segment_index = body.get("segment_index")
    new_text = body.get("text")

    if segment_index is None or new_text is None:
        raise HTTPException(400, "segment_index and text are required")

    if segment_index < 0 or segment_index >= len(data["segments"]):
        raise HTTPException(400, "Invalid segment_index")

    data["segments"][segment_index]["text"] = new_text
    transcript_path.write_text(json.dumps(data, ensure_ascii=False, indent=2))

    return data


def _format_srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


@router.get("/{audio_id}/download")
async def download_transcription(
    audio_id: str,
    format: str = Query("txt", pattern="^(txt|srt)$"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AudioFile).where(AudioFile.id == audio_id))
    audio = result.scalar_one_or_none()
    if not audio:
        raise HTTPException(404, "Audio not found")

    transcript_path = PROJECTS_DIR / audio.project_id / "transcripts" / f"{audio_id}.json"
    if not transcript_path.exists():
        raise HTTPException(404, "Transcript not found")

    data = json.loads(transcript_path.read_text())
    segments = data["segments"]
    name = Path(audio.original_name or audio.filename).stem

    if format == "srt":
        lines = []
        for i, seg in enumerate(segments, 1):
            lines.append(str(i))
            lines.append(f"{_format_srt_time(seg['start'])} --> {_format_srt_time(seg['end'])}")
            lines.append(seg["text"])
            lines.append("")
        content = "\n".join(lines)
        filename = f"{name}.srt"
    else:
        lines = []
        for seg in segments:
            ts = f"[{_format_srt_time(seg['start'])} --> {_format_srt_time(seg['end'])}]"
            lines.append(f"{ts}  {seg['text']}")
        content = "\n".join(lines)
        filename = f"{name}.txt"

    encoded = quote(filename)
    return PlainTextResponse(
        content,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded}",
        },
        media_type="text/plain; charset=utf-8",
    )
