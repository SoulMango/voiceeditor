# VoiceEditor

[한국어](README.ko.md)

A web-based voice extraction and editing tool. Collect audio from YouTube or system output, generate word-level transcripts with STT, edit with a synchronized waveform + text UI, cut and rearrange segments, and remove background music with AI — all in one place.

## Features

- **YouTube Audio Extraction** — Download audio from any YouTube URL (yt-dlp)
- **System Audio Recording** — Record system output via BlackHole (macOS)
- **File Upload** — Drag-and-drop local audio files
- **Speech-to-Text** — Word-level timestamps via faster-whisper
- **Waveform + Text Sync** — wavesurfer.js waveform with per-word highlighting and click-to-seek
- **Inline Text Editing** — Edit transcript text per segment
- **Cut & Rearrange** — Select regions on the waveform, cut into segments, drag to reorder
- **Background Removal** — Vocal/music separation with Demucs AI, switch between stems
- **Export** — Download as WAV/MP3 audio or TXT/SRT transcript

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python + FastAPI + SQLite (SQLAlchemy async) |
| Frontend | React + TypeScript + Vite + TailwindCSS v4 |
| State | Zustand |
| Audio | yt-dlp, sounddevice, ffmpeg |
| STT | faster-whisper (word_timestamps) |
| Separation | Demucs (htdemucs) + torchcodec |
| Waveform | wavesurfer.js + RegionsPlugin |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |

## Prerequisites

- Python 3.11–3.13 (recommended) or Python 3.14+ (requires separate Python 3.11–3.13 for Demucs)
- Node.js 18+
- ffmpeg (`brew install ffmpeg` / `sudo apt install ffmpeg`)
- BlackHole (macOS system audio recording — [download](https://existential.audio/blackhole/))

> **Python version note**: With Python 3.11–3.13, all dependencies (including Demucs) are installed in a single venv.
> Python 3.14+ is incompatible with Demucs, so the setup script automatically creates a separate venv.

## Quick Start

### Automated Setup

```bash
git clone https://github.com/chadingTV/voiceeditor.git
cd voiceeditor
./scripts/setup.sh
```

The setup script automatically:
1. Checks prerequisites (python3, node, npm, ffmpeg)
2. Detects Python version → single venv or separate Demucs venv
3. Creates backend Python venv and installs dependencies
4. (Python 3.14+ only) Creates Demucs venv with compatible Python
5. Installs SwitchAudioSource (macOS, for system audio recording)
6. Installs frontend npm packages

### Run

```bash
# Start both backend and frontend
./scripts/dev.sh
```

Open `http://localhost:5173` in your browser.

### Manual Setup

<details>
<summary>Click here for manual installation steps</summary>

#### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# If Python 3.11-3.13, also install demucs:
pip install -r requirements-demucs.txt
```

#### Demucs Separate Env (Python 3.14+ only)

```bash
cd backend
python3.12 -m venv .venv-demucs  # or python3.11, python3.13
source .venv-demucs/bin/activate
pip install -r requirements-demucs.txt
deactivate
```

#### Frontend

```bash
cd frontend
npm install
```

#### Run Individually

```bash
# Backend
cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

</details>

## Project Structure

```
voiceeditor/
├── backend/
│   ├── main.py                  # FastAPI app
│   ├── config.py                # Configuration
│   ├── requirements.txt         # Main backend dependencies
│   ├── requirements-demucs.txt  # Demucs-specific dependencies
│   ├── routers/                 # API routers
│   │   ├── projects.py          # Project CRUD
│   │   ├── audio.py             # Audio import (YouTube/upload/recording)
│   │   ├── transcription.py     # STT + text editing + TXT/SRT download
│   │   ├── separation.py        # Background removal (Demucs subprocess)
│   │   └── editor.py            # Segment editing & export
│   ├── services/                # Business logic
│   ├── models/                  # DB models & schemas
│   └── tasks/                   # Background task manager
├── frontend/
│   └── src/
│       ├── api/                 # API client modules
│       ├── stores/              # Zustand stores
│       ├── components/
│       │   ├── layout/          # AppShell, Header, Sidebar
│       │   ├── import/          # YouTube, upload, recording UI
│       │   └── editor/          # Waveform editor, transcript panel, segment timeline
│       ├── hooks/               # Custom hooks
│       └── types/               # TypeScript types
└── scripts/
    ├── setup.sh                 # Automated setup script
    └── dev.sh                   # Dev server launcher
```

## Usage

1. **Create a project** — Click "New Project" in the sidebar
2. **Import audio** — Paste a YouTube URL, upload a file, or record system audio
3. **Generate transcript** — Click "Generate STT" in the editor
4. **Review & edit text** — Click the pencil icon on any segment to edit inline
5. **Cut segments** — Drag-select a region on the waveform → "Cut Selection"
6. **Reorder** — Drag segments in the timeline to rearrange
7. **Remove background** — Click "Remove Background" → select Vocals/No Vocals stem
8. **Export** — Download audio (WAV/MP3) or transcript (TXT/SRT)

## Architecture Notes

### Demucs Execution

Demucs always runs as a subprocess. The Python executable is auto-detected based on the environment:

| System Python | Demucs Strategy |
|---------------|----------------|
| 3.11–3.13 | Runs directly from the main venv (single venv) |
| 3.14+ | Runs from `.venv-demucs` with compatible Python (dual venv) |

```
Backend (separation.py)
    │
    ├── _find_demucs_python()  ← auto-detect
    │       │
    │       ├── .venv-demucs exists? → .venv-demucs/bin/python3
    │       └── otherwise → try current python's demucs
    │
    └── subprocess.run([python, "-m", "demucs", ...])
```

## License

This project is licensed under the [MIT License](LICENSE).
