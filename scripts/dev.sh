#!/bin/bash
# Start both backend and frontend dev servers
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Start backend
echo "Starting backend..."
cd "$ROOT_DIR/backend"
source .venv/bin/activate
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# Start frontend
echo "Starting frontend..."
cd "$ROOT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8000 (PID: $BACKEND_PID)"
echo "Frontend: http://localhost:5173 (PID: $FRONTEND_PID)"
echo "API docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
