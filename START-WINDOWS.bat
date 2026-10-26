@echo off
setlocal EnableDelayedExpansion
title IdeaForge AI
cd /d "%~dp0"
set PYTHONUTF8=1
echo.
echo  ==========================================
echo    IdeaForge AI  -  starting up
echo  ==========================================
echo.

REM ---- 0. Must be run from the extracted folder, not from inside the zip ----
if not exist "backend\requirements.txt" (
  echo  [X] This file was opened from inside the ZIP, so the rest of the project is missing.
  echo      Fix: close this window, right-click ideaforge-ai.zip, choose "Extract All...",
  echo      open the extracted ideaforge-ai folder and double-click START-WINDOWS.bat there.
  pause & exit /b 1
)

REM ---- 1. Python check -------------------------------------------------------
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
if errorlevel 1 (
  echo  [X] Python 3.10+ is not installed or not on PATH.
  echo      Install Python 3.11 or 3.12 from https://www.python.org/downloads/
  echo      IMPORTANT: tick "Add python.exe to PATH" on the first installer screen.
  pause & exit /b 1
)

REM ---- 2. Virtual environment + packages (first run only) --------------------
if not exist ".venv\Scripts\python.exe" (
  echo  [1/4] Creating Python environment...
  python -m venv .venv || (echo  [X] Could not create the environment. & pause & exit /b 1)
)
if not exist ".venv\.installed" (
  echo  [2/4] Installing packages - takes 1-3 minutes the first time...
  ".venv\Scripts\python.exe" -m pip install --upgrade pip -q
  ".venv\Scripts\python.exe" -m pip install -q -r backend\requirements.txt || (echo  [X] Package install failed. Check your internet connection. & pause & exit /b 1)
  type nul > ".venv\.installed"
)

REM ---- 3. API key (asked once, saved in .env) --------------------------------
if not exist ".env" (
  echo.
  echo  [3/4] Get a free Gemini API key at https://aistudio.google.com/apikey
  set /p "KEY=       Paste your key here and press Enter: "
  > ".env" echo GEMINI_API_KEY=!KEY!
  >> ".env" echo EMBEDDER=auto
  >> ".env" echo GEMMA_TPM=15000
  echo        Saved to .env
)

REM ---- 4. Website build (only if the prebuilt one is missing) ----------------
if not exist "frontend\dist\index.html" (
  where npm >nul 2>nul
  if errorlevel 1 (
    echo  [X] frontend\dist is missing and Node.js is not installed. Install Node 20 LTS from https://nodejs.org and run this again.
    pause & exit /b 1
  )
  echo  Building the website...
  pushd frontend & call npm install & call npm run build & popd
)

REM ---- Optional: add live papers + GitHub repos to the collection (first run) -
if not exist "data\collection\.live_added" (
  echo.
  echo  [4/4] Adding real papers ^(OpenAlex, arXiv^) and GitHub projects to the collection - about 2-4 minutes...
  echo        ^(Press Ctrl+C to skip; the app still works with the bundled collection.^)
  pushd backend
  "..\.venv\Scripts\python.exe" scripts\build_collection.py --sources openalex,arxiv,github --per-topic 20
  popd
  type nul > "data\collection\.live_added"
)

echo.
echo  ==========================================
echo    IdeaForge AI is running:  http://localhost:8765
echo    Keep this window open. Close it to stop.
echo  ==========================================
start "" "http://localhost:8765"
cd backend
"..\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8765
pause
