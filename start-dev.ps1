param(
    [switch]$SkipInstall,
    [switch]$SkipDocker
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvPath = Join-Path $repoRoot ".venv"
$pythonExe = Join-Path $venvPath "Scripts\python.exe"
$frontendPath = Join-Path $repoRoot "frontend"
$backendPath = Join-Path $repoRoot "backend"

function Test-Command {
    param([string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Host "Repository root: $repoRoot"

if (-not (Test-Command "python")) {
    throw "Python is not available on PATH. Install Python 3.12+ and try again."
}

if (-not (Test-Path $venvPath)) {
    Write-Host "Creating project virtual environment..."
    & python -m venv $venvPath
}

if (-not $SkipInstall) {
    Write-Host "Installing backend dependencies..."
    & $pythonExe -m pip install -r (Join-Path $backendPath "requirements.txt")

    if (-not (Test-Command "npm")) {
        throw "npm is not available on PATH. Install Node.js and try again."
    }

    if (-not (Test-Path (Join-Path $frontendPath "node_modules"))) {
        Write-Host "Installing frontend dependencies..."
        Push-Location $frontendPath
        try {
            & npm install
        }
        finally {
            Pop-Location
        }
    }
}

if (-not $SkipDocker) {
    if (-not (Test-Command "docker")) {
        throw "Docker is not available on PATH. Install Docker Desktop or rerun with -SkipDocker."
    }

    Write-Host "Starting PostgreSQL and MinIO..."
    Push-Location $repoRoot
    try {
        & docker compose up -d postgres minio
    }
    finally {
        Pop-Location
    }
}

$backendCommand = @(
    "Set-Location '$backendPath'",
    "& '$pythonExe' -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload"
) -join "; "

$frontendCommand = @(
    "Set-Location '$frontendPath'",
    "npm start"
) -join "; "

Write-Host "Launching backend on http://127.0.0.1:8001 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand | Out-Null

Write-Host "Launching frontend on http://localhost:3001 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCommand | Out-Null

Write-Host ""
Write-Host "Development services are starting in separate PowerShell windows."
Write-Host "Backend:  http://127.0.0.1:8001"
Write-Host "Frontend: http://localhost:3001"
