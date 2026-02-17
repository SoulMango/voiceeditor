from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from models.database import init_db
from routers import projects, audio, transcription, separation, editor


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Voice Editor", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(audio.router)
app.include_router(transcription.router)
app.include_router(separation.router)
app.include_router(editor.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
