from datetime import datetime
from pydantic import BaseModel


# --- Project ---

class ProjectCreate(BaseModel):
    name: str
    description: str = ""


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str
    created_at: datetime
    updated_at: datetime


class ProjectDetailResponse(ProjectResponse):
    audio_files: list["AudioFileResponse"]


# --- AudioFile ---

class AudioFileResponse(BaseModel):
    id: str
    project_id: str
    filename: str
    original_name: str | None
    duration: float | None
    sample_rate: int | None
    source_type: str | None
    source_url: str | None
    has_transcript: bool
    has_separation: bool
    created_at: datetime


# --- YouTube ---

class YouTubeRequest(BaseModel):
    url: str
    project_id: str


# --- Recording ---

class RecordStartRequest(BaseModel):
    project_id: str
    device_name: str = "BlackHole 16ch"


class RecordStopRequest(BaseModel):
    recording_id: str


# --- Transcription ---

class TranscriptionStartRequest(BaseModel):
    audio_id: str
    language: str | None = None
    model_size: str = "base"


class WordTimestamp(BaseModel):
    start: float
    end: float
    word: str
    probability: float


class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str
    words: list[WordTimestamp]


class TranscriptionResponse(BaseModel):
    audio_id: str
    language: str
    segments: list[TranscriptSegment]


# --- Separation ---

class SeparationStartRequest(BaseModel):
    audio_id: str
    model: str = "htdemucs"


class SeparationResponse(BaseModel):
    audio_id: str
    stems: list[str]


# --- Segment ---

class SegmentCreate(BaseModel):
    audio_id: str
    start_time: float
    end_time: float
    label: str = ""


class SegmentUpdate(BaseModel):
    start_time: float | None = None
    end_time: float | None = None
    label: str | None = None


class SegmentResponse(BaseModel):
    id: str
    project_id: str
    audio_id: str
    start_time: float
    end_time: float
    label: str
    sort_order: int
    created_at: datetime


class SegmentReorderRequest(BaseModel):
    segment_ids: list[str]


# --- Export ---

class ExportRequest(BaseModel):
    format: str = "wav"
    stem: str = "original"


# --- Task ---

class TaskResponse(BaseModel):
    id: str
    status: str
    progress: float
    result: dict | None = None
    error: str | None = None
