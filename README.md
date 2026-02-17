# VoiceEditor

웹 기반 음성 추출 및 편집 프로그램입니다. YouTube/시스템 오디오에서 음성을 수집하고, STT로 텍스트를 생성하며, 파형+텍스트 동기화 편집 UI에서 자르고 붙이고, AI로 배경음을 제거하는 올인원 도구입니다.

## 주요 기능

- **YouTube 오디오 추출** — URL 입력만으로 오디오 다운로드 (yt-dlp)
- **시스템 오디오 녹음** — BlackHole을 통한 시스템 출력 녹음 (macOS)
- **파일 업로드** — 로컬 오디오 파일 드래그 앤 드롭 업로드
- **STT (음성→텍스트)** — faster-whisper 기반 단어별 타임스탬프 생성
- **파형+텍스트 동기화 편집** — wavesurfer.js 파형 표시, 단어 단위 하이라이트, 클릭으로 탐색
- **세그먼트 자르기/붙이기** — 파형에서 영역 선택 → 자르기 → 드래그로 재배치
- **배경음 제거** — Demucs AI 모델로 보컬/배경음 분리
- **내보내기** — WAV/MP3 내보내기, 텍스트 TXT/SRT 다운로드

## 기술 스택

| 영역 | 기술 |
|------|------|
| Backend | Python + FastAPI + SQLite (SQLAlchemy async) |
| Frontend | React + TypeScript + Vite + TailwindCSS v4 |
| 상태관리 | Zustand |
| 오디오 처리 | yt-dlp, sounddevice, pydub, ffmpeg |
| STT | faster-whisper (word_timestamps) |
| 음원 분리 | Demucs (htdemucs, Python 3.11 별도 venv) |
| 파형 | wavesurfer.js + RegionsPlugin |
| 드래그앤드롭 | @dnd-kit/core + @dnd-kit/sortable |

## 사전 요구사항

- Python 3.12+
- Node.js 18+
- ffmpeg
- BlackHole (macOS 시스템 오디오 녹음 시 필요)
- Python 3.11 (Demucs용 별도 venv)

## 설치 및 실행

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Demucs 별도 환경 (Python 3.11 필요)

```bash
cd backend
python3.11 -m venv .venv-demucs
source .venv-demucs/bin/activate
pip install demucs
deactivate
```

### Frontend

```bash
cd frontend
npm install
```

### 실행

```bash
# 동시 실행
./scripts/dev.sh

# 또는 개별 실행
# Backend
cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

브라우저에서 `http://localhost:5173` 으로 접속합니다.

## 프로젝트 구조

```
voiceeditor/
├── backend/
│   ├── main.py              # FastAPI 앱
│   ├── config.py            # 설정
│   ├── routers/             # API 라우터
│   │   ├── projects.py      # 프로젝트 CRUD
│   │   ├── audio.py         # 오디오 수집 (YouTube/업로드/녹음)
│   │   ├── transcription.py # STT
│   │   ├── separation.py    # 배경음 제거
│   │   └── editor.py        # 세그먼트 편집/내보내기
│   ├── services/            # 비즈니스 로직
│   ├── models/              # DB 모델 & 스키마
│   └── tasks/               # 백그라운드 태스크
├── frontend/
│   └── src/
│       ├── api/             # API 클라이언트
│       ├── stores/          # Zustand 스토어
│       ├── components/      # React 컴포넌트
│       ├── hooks/           # 커스텀 훅
│       └── types/           # TypeScript 타입
└── scripts/
    └── dev.sh               # 개발 서버 실행
```

## 사용 방법

1. 프로젝트 생성
2. YouTube URL 입력 또는 파일 업로드로 오디오 수집
3. "Generate STT" 버튼으로 텍스트 생성
4. 파형에서 영역 선택 → "Cut Selection"으로 세그먼트 생성
5. 세그먼트를 드래그하여 원하는 순서로 재배치
6. "Export" 버튼으로 최종 오디오 내보내기
7. 필요시 "Remove Background" 버튼으로 배경음 제거 후 보컬 트랙에서 편집
