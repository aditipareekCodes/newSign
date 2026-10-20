@echo off
echo ====================================================
echo Starting SignVaani Full-Stack Application
echo ====================================================
echo.
echo 1. Launching FastAPI Backend on http://127.0.0.1:8000...
start "SignVaani Backend Server" python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir backend
timeout /t 2 /nobreak >nul
echo.
echo 2. Launching Vite Frontend on http://localhost:5173...
npm run dev
