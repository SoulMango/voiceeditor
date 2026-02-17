import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import PROJECTS_DIR
from models.database import Segment, AudioFile, Project, get_db
from models.schemas import SegmentCreate, SegmentUpdate, SegmentResponse, SegmentReorderRequest, ExportRequest

router = APIRouter(prefix="/api/editor", tags=["editor"])


@router.get("/{project_id}/segments", response_model=list[SegmentResponse])
async def list_segments(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Segment)
        .where(Segment.project_id == project_id)
        .order_by(Segment.sort_order)
    )
    return result.scalars().all()


@router.post("/{project_id}/segments", response_model=SegmentResponse, status_code=201)
async def create_segment(project_id: str, data: SegmentCreate, db: AsyncSession = Depends(get_db)):
    # Get max sort_order
    result = await db.execute(
        select(Segment)
        .where(Segment.project_id == project_id)
        .order_by(Segment.sort_order.desc())
    )
    existing = result.scalars().first()
    next_order = (existing.sort_order + 1) if existing else 0

    segment = Segment(
        id=str(uuid.uuid4()),
        project_id=project_id,
        audio_id=data.audio_id,
        start_time=data.start_time,
        end_time=data.end_time,
        label=data.label,
        sort_order=next_order,
    )
    db.add(segment)
    await db.commit()
    await db.refresh(segment)
    return segment


@router.put("/{project_id}/segments/{segment_id}", response_model=SegmentResponse)
async def update_segment(
    project_id: str,
    segment_id: str,
    data: SegmentUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Segment).where(Segment.id == segment_id, Segment.project_id == project_id)
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(404, "Segment not found")

    if data.start_time is not None:
        segment.start_time = data.start_time
    if data.end_time is not None:
        segment.end_time = data.end_time
    if data.label is not None:
        segment.label = data.label

    await db.commit()
    await db.refresh(segment)
    return segment


@router.delete("/{project_id}/segments/{segment_id}", status_code=204)
async def delete_segment(project_id: str, segment_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Segment).where(Segment.id == segment_id, Segment.project_id == project_id)
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(404, "Segment not found")

    await db.delete(segment)
    await db.commit()


@router.put("/{project_id}/segments/reorder")
async def reorder_segments(project_id: str, data: SegmentReorderRequest, db: AsyncSession = Depends(get_db)):
    for i, seg_id in enumerate(data.segment_ids):
        result = await db.execute(
            select(Segment).where(Segment.id == seg_id, Segment.project_id == project_id)
        )
        segment = result.scalar_one_or_none()
        if segment:
            segment.sort_order = i

    await db.commit()
    return {"status": "ok"}


@router.post("/{project_id}/export")
async def export_segments(project_id: str, data: ExportRequest, db: AsyncSession = Depends(get_db)):
    from tasks.background import task_manager
    from services.audio_processor import cut_and_concat

    result = await db.execute(
        select(Segment)
        .where(Segment.project_id == project_id)
        .order_by(Segment.sort_order)
    )
    segments = result.scalars().all()
    if not segments:
        raise HTTPException(400, "No segments to export")

    task = task_manager.create_task()

    async def do_export():
        seg_list = []
        source_path = None

        for seg in segments:
            if source_path is None:
                audio_result = await db.execute(
                    select(AudioFile).where(AudioFile.id == seg.audio_id)
                )
                audio = audio_result.scalar_one_or_none()
                if not audio:
                    raise ValueError(f"Audio {seg.audio_id} not found")

                if data.stem != "original":
                    source_path = str(PROJECTS_DIR / audio.project_id / "separated" / f"{seg.audio_id}_{data.stem}.wav")
                else:
                    source_path = str(PROJECTS_DIR / audio.project_id / "original" / audio.filename)

            seg_list.append({"start_time": seg.start_time, "end_time": seg.end_time})

        export_dir = PROJECTS_DIR / project_id / "exports"
        export_dir.mkdir(parents=True, exist_ok=True)

        ext = {"wav": "wav", "mp3": "mp3", "flac": "flac"}.get(data.format, "wav")
        export_path = str(export_dir / f"export_{task.id}.{ext}")

        await task_manager.run_in_thread(
            cut_and_concat, source_path, seg_list, export_path, data.format
        )

        return {"export_path": export_path, "filename": f"export.{ext}"}

    task_manager.run_in_background(task, do_export())
    return {"task_id": task.id}


@router.get("/{project_id}/export/{task_id}")
async def download_export(project_id: str, task_id: str):
    from tasks.background import task_manager

    task = task_manager.get_task(task_id)
    if not task or task.status.value != "completed":
        raise HTTPException(404, "Export not ready")

    export_path = task.result.get("export_path")
    if not export_path or not Path(export_path).exists():
        raise HTTPException(404, "Export file not found")

    return FileResponse(
        export_path,
        media_type="application/octet-stream",
        filename=task.result.get("filename", "export.wav"),
    )
