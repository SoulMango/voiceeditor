#!/bin/bash
# VoiceEditor 자동 설치 스크립트
# 사용법: ./scripts/setup.sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ─── 사전 요구사항 체크 ─────────────────────────────────────────

echo ""
echo "========================================="
echo "  VoiceEditor Setup"
echo "========================================="
echo ""

MISSING=()

# Python 체크
PYTHON_CMD=""
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
    PY_VER=$(python3 --version 2>&1 | awk '{print $2}')
    PY_MINOR=$(python3 -c "import sys; print(sys.version_info.minor)" 2>/dev/null)
    info "Python: $PY_VER"
else
    MISSING+=("python3")
fi

# Node.js 체크
if command -v node &>/dev/null; then
    info "Node.js: $(node --version 2>&1)"
else
    MISSING+=("node")
fi

# npm 체크
if command -v npm &>/dev/null; then
    info "npm: $(npm --version 2>&1)"
else
    MISSING+=("npm")
fi

# ffmpeg 체크
if command -v ffmpeg &>/dev/null; then
    info "ffmpeg: installed"
else
    MISSING+=("ffmpeg")
fi

if [ ${#MISSING[@]} -gt 0 ]; then
    error "Missing required tools: ${MISSING[*]}"
    echo ""
    echo "Install on macOS:  brew install ${MISSING[*]}"
    echo "Install on Ubuntu: sudo apt install ${MISSING[*]}"
    echo ""
    exit 1
fi

echo ""

# ─── Python 버전에 따른 전략 결정 ──────────────────────────────

# Python 3.14+는 torch/demucs와 호환 문제가 있어 별도 venv 필요
# Python 3.11~3.13은 단일 venv로 전부 설치 가능

NEED_SEPARATE_DEMUCS=false
DEMUCS_PYTHON=""

if [ -n "$PYTHON_CMD" ] && [ "$PY_MINOR" -ge 14 ] 2>/dev/null; then
    info "Python 3.14+ detected — Demucs needs a separate venv (Python 3.11~3.13)"
    NEED_SEPARATE_DEMUCS=true

    # 호환 가능한 Python 찾기
    for ver in python3.13 python3.12 python3.11; do
        if command -v "$ver" &>/dev/null; then
            DEMUCS_PYTHON="$ver"
            info "Found $ver for Demucs"
            break
        fi
    done

    if [ -z "$DEMUCS_PYTHON" ]; then
        warn "Python 3.11~3.13 not found — Demucs (배경음 제거) will not be available"
        warn "Install with: brew install python@3.12"
    fi
else
    info "Python $PY_VER is compatible — single venv for all dependencies"
fi

echo ""

# ─── Backend venv 설치 ──────────────────────────────────────────

info "Setting up backend venv..."

if [ ! -d "$BACKEND_DIR/.venv" ]; then
    $PYTHON_CMD -m venv "$BACKEND_DIR/.venv"
    info "Created backend venv"
else
    info "Backend venv already exists"
fi

source "$BACKEND_DIR/.venv/bin/activate"
info "Installing backend dependencies..."
pip install --upgrade pip -q

if [ "$NEED_SEPARATE_DEMUCS" = true ]; then
    # Python 3.14+: demucs 제외한 메인 패키지만 설치
    pip install -r "$BACKEND_DIR/requirements.txt" -q
else
    # Python 3.11~3.13: 전부 한번에 설치
    pip install -r "$BACKEND_DIR/requirements.txt" -q
    pip install -r "$BACKEND_DIR/requirements-demucs.txt" -q
fi

deactivate
info "Backend dependencies installed"

echo ""

# ─── Demucs 별도 venv (Python 3.14+ 인 경우만) ─────────────────

if [ "$NEED_SEPARATE_DEMUCS" = true ] && [ -n "$DEMUCS_PYTHON" ]; then
    info "Setting up Demucs venv ($DEMUCS_PYTHON)..."

    if [ ! -d "$BACKEND_DIR/.venv-demucs" ]; then
        $DEMUCS_PYTHON -m venv "$BACKEND_DIR/.venv-demucs"
        info "Created Demucs venv"
    else
        info "Demucs venv already exists"
    fi

    source "$BACKEND_DIR/.venv-demucs/bin/activate"
    info "Installing Demucs dependencies (this may take a while)..."
    pip install --upgrade pip -q
    pip install -r "$BACKEND_DIR/requirements-demucs.txt" -q
    deactivate
    info "Demucs dependencies installed"
fi

echo ""

# ─── SwitchAudioSource 설치 (macOS 시스템 녹음용) ──────────────

if [ "$(uname)" = "Darwin" ]; then
    if ! command -v SwitchAudioSource &>/dev/null; then
        if command -v brew &>/dev/null; then
            info "Installing SwitchAudioSource (for system audio recording)..."
            brew install switchaudio-osx -q 2>/dev/null || warn "Failed to install SwitchAudioSource"
        else
            warn "SwitchAudioSource not found — system audio recording requires it"
            warn "Install with: brew install switchaudio-osx"
        fi
    else
        info "SwitchAudioSource: installed"
    fi
fi

echo ""

# ─── Frontend 설치 ──────────────────────────────────────────────

info "Setting up frontend..."
cd "$FRONTEND_DIR"
npm install
info "Frontend dependencies installed"

echo ""

# ─── data 디렉토리 생성 ────────────────────────────────────────

mkdir -p "$BACKEND_DIR/data/projects"
info "Data directory ready"

echo ""

# ─── 완료 ──────────────────────────────────────────────────────

echo "========================================="
echo -e "  ${GREEN}Setup complete!${NC}"
echo "========================================="
echo ""
echo "Run the dev servers:"
echo "  ./scripts/dev.sh"
echo ""
echo "Or individually:"
echo "  Backend:  cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000"
echo "  Frontend: cd frontend && npm run dev"
echo ""
echo "Open http://localhost:5173 in your browser"

if [ "$NEED_SEPARATE_DEMUCS" = true ]; then
    echo ""
    echo "Note: Demucs runs in a separate venv (.venv-demucs) due to Python $PY_VER"
fi
echo ""
