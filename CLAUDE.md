# Voice Editor

Web-based voice extraction and editing application.

## Quick Start

```bash
# Backend
cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm run dev

# Or both at once
./scripts/dev.sh
```

## Tech Stack

- **Backend**: Python 3.14 + FastAPI + SQLite (SQLAlchemy async)
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Audio**: yt-dlp, faster-whisper, demucs, sounddevice, wavesurfer.js

## Project Structure

- `backend/` - FastAPI server
  - `routers/` - API route handlers (projects, audio, transcription, separation, editor)
  - `services/` - Business logic (youtube, recorder, transcriber, separator, waveform, audio_processor)
  - `models/` - SQLAlchemy models + Pydantic schemas
  - `tasks/` - Background task manager
  - `data/` - Runtime data (SQLite DB, project files) - gitignored
- `frontend/` - React SPA
  - `src/api/` - Backend API client functions
  - `src/stores/` - Zustand state stores
  - `src/components/` - React components (layout, project, import, editor, processing)
  - `src/hooks/` - Custom React hooks
  - `src/types/` - TypeScript type definitions

## Key Commands

- Backend API docs: http://localhost:8000/docs
- Frontend dev: http://localhost:5173
- Type check: `cd frontend && npx tsc --noEmit`
