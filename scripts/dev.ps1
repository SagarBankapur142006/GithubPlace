# Ideora local development bootstrap (Windows PowerShell)
# Usage: .\scripts\dev.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "=== Ideora Dev Bootstrap ===" -ForegroundColor Green

# 1. Check Postgres
Write-Host "`nChecking PostgreSQL on localhost:5432..."
$pgReady = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("localhost", 5432)
    $tcp.Close()
    $pgReady = $true
    Write-Host "PostgreSQL is reachable." -ForegroundColor Green
} catch {
    Write-Host "PostgreSQL not running. Start with: docker compose up postgres -d" -ForegroundColor Yellow
    Write-Host "Or install Postgres and create database 'ideora' with user ideora/ideora"
}

if (-not (Test-Path "$Root\backend\.env")) {
    Copy-Item "$Root\backend\.env.example" "$Root\backend\.env"
    Write-Host "Created backend/.env from example — add your API keys."
}

if (-not (Test-Path "$Root\frontend\.env.local")) {
    Copy-Item "$Root\frontend\.env.local.example" "$Root\frontend\.env.local"
    Write-Host "Created frontend/.env.local"
}

if ($pgReady) {
    Write-Host "`nInitializing database and seeding..."
    Push-Location "$Root\backend"
    $env:PYTHONPATH = "$Root\backend"
    python scripts/bootstrap.py
    Pop-Location
}

Write-Host "`n=== Start services in separate terminals ===" -ForegroundColor Cyan
Write-Host "Backend:  cd backend && uvicorn app.main:app --reload --port 8000"
Write-Host "Worker:   cd backend && python -m worker.scheduler"
Write-Host "Frontend: cd frontend && npm run dev"
Write-Host "`nScout once: cd backend && python -m scout.run_once"
Write-Host "API docs:  http://localhost:8000/docs"
