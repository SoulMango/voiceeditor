import json
import shutil
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import PROJECTS_DIR, BASE_DIR
from models.database import AudioFile, get_db

router = APIRouter(prefix="/api/separation", tags=["separation"])


def _find_demucs_python() -> str:
    """Find the Python executable that can run demucs.

    Strategy:
    1. If a separate .venv-demucs exists, use its python (for Python 3.14+ hosts)
    2. Otherwise, try the main venv python (Python 3.11~3.13 can run demucs directly)
    3. Fall back to system python3
    """
    # Check separate demucs venv first
    demucs_venv = BASE_DIR / ".venv-demucs" / "bin" / "python3"
    if demucs_venv.exists():
        return str(demucs_venv)

    # Check if current python can import demucs
    try:
        subprocess.run(
            [sys.executable, "-c", "import demucs"],
            capture_output=True, check=True,
        )
        return sys.executable
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass

    raise RuntimeError(
        "Demucs not found. Run ./scripts/setup.sh or install demucs manually. "
        "If Python 3.14+, a separate .venv-demucs with Python 3.11~3.13 is required."
    )


# Lazy-initialized on first use
_demucs_python: str | None = None


def _get_demucs_python() -> str:
    global _demucs_python
    if _demucs_python is None:
        _demucs_python = _find_demucs_python()
    return _demucs_python


def _separate_sync(audio_path: str, output_dir: str, audio_id: str, model_name: str) -> list[str]:
    """Run demucs via subprocess."""
    python = _get_demucs_python()
    result = subprocess.run(
        [
            python, "-m", "demucs",
            "--two-stems", "vocals",
            "-n", model_name,
            "-o", output_dir,
            audio_path,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Demucs failed: {result.stderr[-500:]}")

    # Demucs outputs to: output_dir/htdemucs/<filename_stem>/vocals.wav, no_vocals.wav
    audio_stem = Path(audio_path).stem
    demucs_out = Path(output_dir) / model_name / audio_stem

    if not demucs_out.exists():
        # Try to find the output directory
        for d in (Path(output_dir) / model_name).iterdir():
            if d.is_dir():
                demucs_out = d
                break

    stems = []
    for stem_file in sorted(demucs_out.glob("*.wav")):
        stem_name = stem_file.stem  # "vocals" or "no_vocals"
        dest = Path(output_dir) / f"{audio_id}_{stem_name}.wav"
        shutil.copy2(str(stem_file), str(dest))
        stems.append(stem_name)

    # Clean up demucs output directory
    demucs_model_dir = Path(output_dir) / model_name
    if demucs_model_dir.exists():
        shutil.rmtree(str(demucs_model_dir))

    return stems


@router.post("/start")
async def start_separation(req: dict, db: AsyncSession = Depends(get_db)):
    from tasks.background import task_manager
    from models.schemas import SeparationStartRequest

    data = SeparationStartRequest(**req)

    result = await db.execute(select(AudioFile).where(AudioFile.id == data.audio_id))
    audio = result.scalar_one_or_none()
    if not audio:
        raise HTTPException(404, "Audio not found")

    # Check demucs availability before starting task
    try:
        _get_demucs_python()
    except RuntimeError as e:
        raise HTTPException(400, str(e))

    audio_path = str(PROJECTS_DIR / audio.project_id / "original" / audio.filename)
    output_dir = str(PROJECTS_DIR / audio.project_id / "separated")
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    task = task_manager.create_task()

    async def do_separate():
        stems = await task_manager.run_in_thread(
            _separate_sync, audio_path, output_dir, data.audio_id, data.model
        )

        # Save stems list
        stems_path = Path(output_dir) / f"{data.audio_id}_stems.json"
        stems_path.write_text(json.dumps(stems))

        audio.has_separation = True
        async with db.begin():
            db.add(audio)

        return {"audio_id": data.audio_id, "stems": stems}

    task_manager.run_in_background(task, do_separate())
    return {"task_id": task.id}


@router.get("/{audio_id}")
async def get_separation(audio_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AudioFile).where(AudioFile.id == audio_id))
    audio = result.scalar_one_or_none()
    if not audio:
        raise HTTPException(404, "Audio not found")

    stems_path = PROJECTS_DIR / audio.project_id / "separated" / f"{audio_id}_stems.json"
    if not stems_path.exists():
        raise HTTPException(404, "Separation results not found")

    stems = json.loads(stems_path.read_text())
    return {"audio_id": audio_id, "stems": stems}


@router.get("/{audio_id}/{stem}")
async def get_stem_file(audio_id: str, stem: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AudioFile).where(AudioFile.id == audio_id))
    audio = result.scalar_one_or_none()
    if not audio:
        raise HTTPException(404, "Audio not found")

    stem_path = PROJECTS_DIR / audio.project_id / "separated" / f"{audio_id}_{stem}.wav"
    if not stem_path.exists():
        raise HTTPException(404, f"Stem '{stem}' not found")

    return FileResponse(str(stem_path), media_type="audio/wav")
