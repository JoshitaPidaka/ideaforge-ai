#!/usr/bin/env bash
# IdeaForge AI one-command start for macOS / Linux
set -e
cd "$(dirname "$0")"
command -v python3 >/dev/null || { echo "Install Python 3.11+ first: https://www.python.org/downloads/"; exit 1; }
[ -x .venv/bin/python ] || python3 -m venv .venv
[ -f .venv/.installed ] || { .venv/bin/pip install -q --upgrade pip; .venv/bin/pip install -q -r backend/requirements.txt; touch .venv/.installed; }
if [ ! -f .env ]; then
  echo "Get a free Gemini API key at https://aistudio.google.com/apikey"
  read -rp "Paste your key: " KEY
  printf 'GEMINI_API_KEY=%s\nEMBEDDER=auto\nGEMMA_TPM=15000\n' "$KEY" > .env
fi
if [ ! -f frontend/dist/index.html ]; then (cd frontend && npm install && npm run build); fi
if [ ! -f data/collection/.live_added ]; then
  echo "Adding real papers and GitHub projects to the collection (2-4 min, Ctrl+C to skip)..."
  (cd backend && ../.venv/bin/python scripts/build_collection.py --sources openalex,arxiv,github --per-topic 20) || true
  touch data/collection/.live_added
fi
echo "IdeaForge AI → http://localhost:8765"
( sleep 3; (command -v open >/dev/null && open http://localhost:8765) || (command -v xdg-open >/dev/null && xdg-open http://localhost:8765) || true ) &
cd backend && exec ../.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8765
