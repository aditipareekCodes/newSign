Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Starting SignVaani Full-Stack Application" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Launching FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Yellow
$backendJob = Start-Process python -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir backend" -PassThru
Start-Sleep -Seconds 2
Write-Host "2. Launching Vite Frontend on http://localhost:5173..." -ForegroundColor Green
try {
    npm run dev
} finally {
    if ($backendJob -and -not $backendJob.HasExited) {
        Write-Host "Stopping Backend Server..." -ForegroundColor Yellow
        Stop-Process -Id $backendJob.Id -Force -ErrorAction SilentlyContinue
    }
}
