@echo off
echo Starting PostgreSQL...
start /B "" "d:\githubsteal\pgsql\bin\pg_ctl" start -D "d:\githubsteal\pgsql\data" -l "d:\githubsteal\pgsql\logfile"
timeout /t 3 >nul

echo Starting Backend API...
cd d:\githubsteal\backend
start "Ideora Backend" cmd /k "python -m uvicorn app.main:app --reload --port 8000"

echo Starting Frontend...
cd d:\githubsteal\frontend
start "Ideora Frontend" cmd /k "npm run dev"

echo.
echo ========================================================
echo Servers are starting up!
echo Frontend will be available at: http://localhost:3000
echo Backend will be available at:  http://localhost:8000
echo ========================================================
pause
