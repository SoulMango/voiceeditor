import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import PROJECTS_DIR, MAX_UPLOAD_SIZE
from models.database import AudioFile, Project, get_db
from models.schemas import YouTubeRequest, RecordStartRequest, RecordStopRequest, AudioFileResponse
from tasks.background import task_manager, TaskStatus
from services.youtube import extract_audio
from services.recorder import recorder
from services.waveform import generate_peaks, save_peaks, get_audio_info

router = APIRouter(prefix="/api", tags=["audio"])


@router.post("/audio/youtube")
async def youtube_import(req: YouTubeRequest, db: AsyncSession = Depends(get_db)):
    # Verify project exists
    result = await db.execute(select(Project).where(Project.id == req.project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Project not found")

    task = task_manager.create_task()
    project_dir = PROJECTS_DIR / req.project_id

    async def do_extract():
        output_dir = str(project_dir / "original")
        info = await task_manager.run_in_thread(extract_audio, req.url, output_dir)

        audio_path = str(project_dir / "original" / info["filename"])
        audio_info = await task_manager.run_in_thread(get_audio_info, audio_path)

        waveform_dir = str(project_dir / "waveforms")
        await task_manager.run_in_thread(save_peaks, audio_path, waveform_dir)

        audio_id = str(uuid.uuid4())
        audio_file = AudioFile(
            id=audio_id,
            project_id=req.project_id,
            filename=info["filename"],
            original_name=info["title"],
            duration=audio_info["duration"],
            sample_rate=audio_info["sample_rate"],
            source_type="youtube",
            source_url=req.url,
        )
        async with db.begin():
            db.add(audio_file)

        return {"audio_id": audio_id}

    task_manager.run_in_background(task, do_extract())
    return {"task_id": task.id}


@router.post("/audio/upload")
async def upload_audio(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Project not found")

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(413, "File too large (max 500MB)")

    audio_id = str(uuid.uuid4())
    ext = Path(file.filename or "audio.wav").suffix or ".wav"
    filename = f"{audio_id}{ext}"
    audio_path = PROJECTS_DIR / project_id / "original" / filename

    audio_path.parent.mkdir(parents=True, exist_ok=True)
    audio_path.write_bytes(content)

    audio_info = get_audio_info(str(audio_path))
    waveform_dir = str(PROJECTS_DIR / project_id / "waveforms")
    save_peaks(str(audio_path), waveform_dir)

    audio_file = AudioFile(
        id=audio_id,
        project_id=project_id,
        filename=filename,
        original_name=file.filename,
        duration=audio_info["duration"],
        sample_rate=audio_info["sample_rate"],
        source_type="upload",
    )
    db.add(audio_file)
    await db.commit()

    return {"audio_id": audio_id}


@router.post("/audio/record/start")
async def start_recording(req: RecordStartRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == req.project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Project not found")

    audio_id = str(uuid.uuid4())
    output_path = str(PROJECTS_DIR / req.project_id / "original" / f"{audio_id}.wav")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    try:
        recording_id = recorder.start(output_path, req.device_name)
    except RuntimeError as e:
        raise HTTPException(400, str(e))

    # Store mapping of recording_id -> (audio_id, project_id) temporarily
    recorder._recordings[recording_id]._meta = {
        "audio_id": audio_id,
        "project_id": req.project_id,
        "filename": f"{audio_id}.wav",
    }

    return {"recording_id": recording_id}


@router.post("/audio/record/stop")
async def stop_recording(req: RecordStopRequest, db: AsyncSession = Depends(get_db)):
    session = recorder._recordings.get(req.recording_id)
    if not session:
        raise HTTPException(404, "Recording not found")

    meta = getattr(session, "_meta", None)
    if not meta:
        raise HTTPException(500, "Recording metadata lost")

    output_path = recorder.stop(req.recording_id)

    audio_info = get_audio_info(output_path)
    waveform_dir = str(PROJECTS_DIR / meta["project_id"] / "waveforms")
    save_peaks(output_path, waveform_dir)

    audio_file = AudioFile(
        id=meta["audio_id"],
        project_id=meta["project_id"],
        filename=meta["filename"],
        original_name="System Recording",
        duration=audio_info["duration"],
        sample_rate=audio_info["sample_rate"],
        source_type="recording",
    )
    db.add(audio_file)
    await db.commit()

    return {"audio_id": meta["audio_id"]}


@router.get("/audio/{audio_id}", response_model=AudioFileResponse)
async def get_audio(audio_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AudioFile).where(AudioFile.id == audio_id))
    audio = result.scalar_one_or_none()
    if not audio:
        raise HTTPException(404, "Audio not found")
    return audio


@router.get("/audio/{audio_id}/file")
async def stream_audio(audio_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AudioFile).where(AudioFile.id == audio_id))
    audio = result.scalar_one_or_none()
    if not audio:
        raise HTTPException(404, "Audio not found")

    file_path = PROJECTS_DIR / audio.project_id / "original" / audio.filename
    if not file_path.exists():
        raise HTTPException(404, "Audio file not found on disk")

    return FileResponse(str(file_path), media_type="audio/wav")


@router.get("/audio/{audio_id}/waveform")
async def get_waveform(audio_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AudioFile).where(AudioFile.id == audio_id))
    audio = result.scalar_one_or_none()
    if not audio:
        raise HTTPException(404, "Audio not found")

    audio_name = Path(audio.filename).stem
    waveform_path = PROJECTS_DIR / audio.project_id / "waveforms" / f"{audio_name}.json"
    if not waveform_path.exists():
        raise HTTPException(404, "Waveform data not found")

    return json.loads(waveform_path.read_text())


@router.patch("/audio/{audio_id}")
async def update_audio(audio_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AudioFile).where(AudioFile.id == audio_id))
    audio = result.scalar_one_or_none()
    if not audio:
        raise HTTPException(404, "Audio not found")

    if "original_name" in body:
        audio.original_name = body["original_name"]

    await db.commit()
    await db.refresh(audio)
    return {"id": audio.id, "original_name": audio.original_name}


@router.delete("/audio/{audio_id}", status_code=204)
async def delete_audio(audio_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AudioFile).where(AudioFile.id == audio_id))
    audio = result.scalar_one_or_none()
    if not audio:
        raise HTTPException(404, "Audio not found")

    await db.delete(audio)
    await db.commit()

    file_path = PROJECTS_DIR / audio.project_id / "original" / audio.filename
    if file_path.exists():
        file_path.unlink()


# --- Task Status ---
@router.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return {
        "id": task.id,
        "status": task.status.value,
        "progress": task.progress,
        "result": task.result,
        "error": task.error,
    }
