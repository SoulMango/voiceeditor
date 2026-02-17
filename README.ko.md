# VoiceEditor

[English](README.md)

웹 기반 음성 추출 및 편집 프로그램입니다. YouTube/시스템 오디오에서 음성을 수집하고, STT로 텍스트를 생성하며, 파형+텍스트 동기화 편집 UI에서 자르고 붙이고, AI로 배경음을 제거하는 올인원 도구입니다.

## 주요 기능

- **YouTube 오디오 추출** — URL 입력만으로 오디오 다운로드 (yt-dlp)
- **시스템 오디오 녹음** — BlackHole을 통한 시스템 출력 녹음 (macOS)
- **파일 업로드** — 로컬 오디오 파일 드래그 앤 드롭 업로드
- **STT (음성→텍스트)** — faster-whisper 기반 단어별 타임스탬프 생성
- **파형+텍스트 동기화 편집** — wavesurfer.js 파형 표시, 단어 단위 하이라이트, 클릭으로 탐색
- **텍스트 편집** — 세그먼트별 텍스트 인라인 수정 가능
- **세그먼트 자르기/붙이기** — 파형에서 영역 선택 → 자르기 → 드래그로 재배치
- **배경음 제거** — Demucs AI 모델로 보컬/배경음 분리, stem 선택 재생
- **내보내기** — WAV/MP3 오디오 내보내기, 텍스트 TXT/SRT 다운로드

## 기술 스택

| 영역 | 기술 |
|------|------|
| Backend | Python + FastAPI + SQLite (SQLAlchemy async) |
| Frontend | React + TypeScript + Vite + TailwindCSS v4 |
| 상태관리 | Zustand |
| 오디오 처리 | yt-dlp, sounddevice, pydub, ffmpeg |
| STT | faster-whisper (word_timestamps) |
| 음원 분리 | Demucs (htdemucs, Python 3.11 별도 venv + torchcodec) |
| 파형 | wavesurfer.js + RegionsPlugin |
| 드래그앤드롭 | @dnd-kit/core + @dnd-kit/sortable |

## 사전 요구사항

- Python 3.11~3.13 (권장) 또는 Python 3.14+ (Demucs용 별도 Python 3.11~3.13 필요)
- Node.js 18+
- ffmpeg (`brew install ffmpeg` / `sudo apt install ffmpeg`)
- BlackHole (macOS 시스템 오디오 녹음 시 필요 — [다운로드](https://existential.audio/blackhole/))

> **Python 버전 참고**: Python 3.11~3.13을 사용하면 단일 venv로 모든 의존성(demucs 포함)이 설치됩니다.
> Python 3.14+는 demucs와 호환되지 않아, setup 스크립트가 자동으로 별도 venv를 구성합니다.

## 빠른 시작

### 자동 설치

```bash
git clone https://github.com/chadingTV/voiceeditor.git
cd voiceeditor
./scripts/setup.sh
```

설치 스크립트가 자동으로 수행하는 작업:
1. 사전 요구사항 체크 (python3, node, npm, ffmpeg)
2. Python 버전 감지 → 단일 venv 또는 별도 demucs venv 자동 결정
3. Backend Python venv 생성 및 패키지 설치
4. (Python 3.14+일 경우) Demucs 전용 venv 생성 및 패키지 설치
5. SwitchAudioSource 설치 (macOS, 시스템 녹음용)
6. Frontend npm 패키지 설치

### 실행

```bash
# 백엔드 + 프론트엔드 동시 실행
./scripts/dev.sh
```

브라우저에서 `http://localhost:5173` 으로 접속합니다.

### 수동 설치

<details>
<summary>수동으로 설치하려면 여기를 클릭</summary>

#### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

#### Demucs 별도 환경 (Python 3.11 필요)

```bash
cd backend
python3.11 -m venv .venv-demucs
source .venv-demucs/bin/activate
pip install -r requirements-demucs.txt
deactivate
```

#### Frontend

```bash
cd frontend
npm install
```

#### 개별 실행

```bash
# Backend
cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

</details>

## 프로젝트 구조

```
voiceeditor/
├── backend/
│   ├── main.py                  # FastAPI 앱
│   ├── config.py                # 설정
│   ├── requirements.txt         # 메인 백엔드 의존성
│   ├── requirements-demucs.txt  # Demucs 전용 의존성
│   ├── routers/                 # API 라우터
│   │   ├── projects.py          # 프로젝트 CRUD
│   │   ├── audio.py             # 오디오 수집 (YouTube/업로드/녹음)
│   │   ├── transcription.py     # STT + 텍스트 편집 + TXT/SRT 다운로드
│   │   ├── separation.py        # 배경음 제거 (Demucs subprocess)
│   │   └── editor.py            # 세그먼트 편집/내보내기
│   ├── services/                # 비즈니스 로직
│   ├── models/                  # DB 모델 & 스키마
│   └── tasks/                   # 백그라운드 태스크
├── frontend/
│   └── src/
│       ├── api/                 # API 클라이언트
│       ├── stores/              # Zustand 스토어
│       ├── components/
│       │   ├── layout/          # AppShell, Header, Sidebar
│       │   ├── import/          # YouTube, 업로드, 녹음 UI
│       │   └── editor/          # 파형 편집기, 텍스트 패널, 세그먼트 타임라인
│       ├── hooks/               # 커스텀 훅
│       └── types/               # TypeScript 타입
└── scripts/
    ├── setup.sh                 # 자동 설치 스크립트
    └── dev.sh                   # 개발 서버 실행
```

## 사용 방법

1. **프로젝트 생성** — 사이드바에서 새 프로젝트 만들기
2. **오디오 수집** — YouTube URL 입력, 파일 업로드, 또는 시스템 오디오 녹음
3. **STT 생성** — 편집기에서 "Generate STT" 버튼 클릭
4. **텍스트 확인/수정** — 세그먼트별 텍스트를 클릭하여 인라인 편집
5. **세그먼트 자르기** — 파형에서 영역 드래그 선택 → "Cut Selection"
6. **순서 변경** — 세그먼트 타임라인에서 드래그로 재배치
7. **배경음 제거** — "Remove Background" 버튼 → 보컬/배경음 stem 선택 드롭다운
8. **내보내기** — 오디오(WAV/MP3), 텍스트(TXT/SRT) 다운로드

## 아키텍처 참고

### Demucs 실행 방식

Demucs는 항상 subprocess로 실행됩니다. Python 버전에 따라 자동으로 경로를 결정합니다:

| 시스템 Python | Demucs 실행 방식 |
|---------------|-----------------|
| 3.11~3.13 | 메인 venv의 python으로 직접 실행 (단일 venv) |
| 3.14+ | `.venv-demucs`의 별도 python으로 실행 (이중 venv) |

```
백엔드 (separation.py)
    │
    ├── _find_demucs_python()  ← 자동 감지
    │       │
    │       ├── .venv-demucs 존재? → .venv-demucs/bin/python3
    │       └── 없으면 → 현재 python에서 demucs import 시도
    │
    └── subprocess.run([python, "-m", "demucs", ...])
```

## 라이센스

이 프로젝트는 [MIT 라이센스](LICENSE)로 배포됩니다.

재배포 또는 파생 프로젝트에 사용 시, 아래 출처를 명시해주세요:

> 원본 프로젝트: **VoiceEditor** by [chadingTV](https://github.com/chadingTV)
> https://github.com/chadingTV/voiceeditor
