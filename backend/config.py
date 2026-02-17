import os
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
PROJECTS_DIR = DATA_DIR / "projects"
MODELS_DIR = DATA_DIR / "models"
DB_PATH = DATA_DIR / "voiceeditor.db"

DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
DEMUCS_MODEL = os.getenv("DEMUCS_MODEL", "htdemucs")
MAX_UPLOAD_SIZE = 500 * 1024 * 1024  # 500MB
