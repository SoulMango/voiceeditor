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
if command -v python3 &>/dev/null; then
    PY_VER=$(python3 --version 2>&1 | awk '{print $2}')
    info "Python: $PY_VER"
else
    MISSING+=("python3")
fi

# Node.js 체크
if command -v node &>/dev/null; then
    NODE_VER=$(node --version 2>&1)
    info "Node.js: $NODE_VER"
else
    MISSING+=("node")
fi

# npm 체크
if command -v npm &>/dev/null; then
    NPM_VER=$(npm --version 2>&1)
    info "npm: $NPM_VER"
else
    MISSING+=("npm")
fi

# ffmpeg 체크
if command -v ffmpeg &>/dev/null; then
    info "ffmpeg: installed"
else
    MISSING+=("ffmpeg")
fi

# Python 3.11 체크 (demucs용)
PYTHON311=""
if command -v python3.11 &>/dev/null; then
    PYTHON311="python3.11"
    info "Python 3.11: $(python3.11 --version 2>&1 | awk '{print $2}')"
elif command -v python3 &>/dev/null; then
    PY_MINOR=$(python3 -c "import sys; print(sys.version_info.minor)" 2>/dev/null)
    if [ "$PY_MINOR" = "11" ]; then
        PYTHON311="python3"
        info "Python 3.11: using python3"
    fi
fi

if [ -z "$PYTHON311" ]; then
    warn "Python 3.11 not found — Demucs (배경음 제거) will not be available"
    warn "Install with: brew install python@3.11"
fi

if [ ${#MISSING[@]} -gt 0 ]; then
    error "Missing required tools: ${MISSING[*]}"
    echo ""
    echo "Install on macOS:"
    echo "  brew install ${MISSING[*]}"
    echo ""
    exit 1
fi

echo ""

# ─── Backend venv 설치 ──────────────────────────────────────────

info "Setting up backend venv..."

if [ ! -d "$BACKEND_DIR/.venv" ]; then
    python3 -m venv "$BACKEND_DIR/.venv"
    info "Created backend venv"
else
    info "Backend venv already exists"
fi

source "$BACKEND_DIR/.venv/bin/activate"
info "Installing backend dependencies..."
pip install --upgrade pip -q
pip install -r "$BACKEND_DIR/requirements.txt" -q
deactivate
info "Backend dependencies installed"

echo ""

# ─── Demucs venv 설치 (Python 3.11) ────────────────────────────

if [ -n "$PYTHON311" ]; then
    info "Setting up Demucs venv (Python 3.11)..."

    if [ ! -d "$BACKEND_DIR/.venv-demucs" ]; then
        $PYTHON311 -m venv "$BACKEND_DIR/.venv-demucs"
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
else
    warn "Skipping Demucs venv setup (Python 3.11 required)"
fi

echo ""

# ─── Frontend 설치 ──────────────────────────────────────────────

info "Setting up frontend..."

cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
    npm install
else
    info "node_modules already exists, running npm install to update..."
    npm install
fi
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
echo ""
