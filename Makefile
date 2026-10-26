.PHONY: setup collection dev backend frontend build test

setup:
	python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
	cd frontend && npm install

collection:          ## fetch GitHub projects + OpenAlex/arXiv papers into data/collection/seed.jsonl
	cd backend && ../.venv/bin/python scripts/build_collection.py

backend:
	cd backend && ../.venv/bin/uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

dev:
	$(MAKE) -j2 backend frontend

build:               ## production: FastAPI serves the built frontend on :8000
	cd frontend && npm run build

test:
	cd backend && ../.venv/bin/python -m pytest -q tests
