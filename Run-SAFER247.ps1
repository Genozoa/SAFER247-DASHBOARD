$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$backendDirectory = Join-Path $projectRoot 'backend'
$frontendDirectory = Join-Path $projectRoot 'frontend'
$virtualEnvironment = Join-Path $backendDirectory '.venv'
$pythonExecutable = Join-Path $virtualEnvironment 'Scripts\python.exe'
$environmentFile = Join-Path $projectRoot '.env'

function Get-EnvironmentValue {
    param([string]$Name)

    $line = Get-Content -LiteralPath $environmentFile |
        Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } |
        Select-Object -First 1
    if (-not $line) {
        return $null
    }

    $value = ($line -split '=', 2)[1].Trim()
    if ($value.Length -ge 2 -and
        (($value.StartsWith('"') -and $value.EndsWith('"')) -or
         ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    return $value
}

function ConvertTo-PowerShellLiteral {
    param([string]$Value)
    return "'" + $Value.Replace("'", "''") + "'"
}

function Start-PowerShellWindow {
    param(
        [string]$WorkingDirectory,
        [string]$Command
    )

    $encodedCommand = [Convert]::ToBase64String(
        [Text.Encoding]::Unicode.GetBytes($Command)
    )
    Start-Process -FilePath (Get-Process -Id $PID).Path `
        -WorkingDirectory $WorkingDirectory `
        -ArgumentList @('-NoExit', '-EncodedCommand', $encodedCommand)
}

if (-not (Test-Path -LiteralPath $environmentFile -PathType Leaf)) {
    throw "Missing root .env file. Copy .env.example to .env and configure it first."
}
if (-not (Test-Path -LiteralPath (Join-Path $frontendDirectory 'package.json') -PathType Leaf)) {
    throw "Frontend package.json was not found at $frontendDirectory."
}
if (-not (Test-Path -LiteralPath (Join-Path $backendDirectory 'requirements.txt') -PathType Leaf)) {
    throw "Backend requirements.txt was not found at $backendDirectory."
}

if (-not $env:DATABASE_URL) {
    $env:DATABASE_URL = Get-EnvironmentValue 'DATABASE_URL'
}
Get-Content -LiteralPath $environmentFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$') {
        $name = $Matches[1]
        $value = $Matches[2].Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}
if (-not $env:RADIO_ENABLED) {
    $env:RADIO_ENABLED = 'true'
}
if (-not $env:DATABASE_URL) {
    throw 'DATABASE_URL is missing from .env.'
}

$passwordSecret = $env:PASSWORD_FINGERPRINT_SECRET
if (-not $passwordSecret) {
    $passwordSecret = Get-EnvironmentValue 'PASSWORD_FINGERPRINT_SECRET'
}
if (-not $passwordSecret -or $passwordSecret -eq 'REPLACE_WITH_A_RANDOM_SECRET') {
    throw 'Set PASSWORD_FINGERPRINT_SECRET in .env before starting the application.'
}

if (-not (Test-Path -LiteralPath $pythonExecutable -PathType Leaf)) {
    $pythonLauncher = Get-Command py -ErrorAction SilentlyContinue
    if (-not $pythonLauncher) {
        throw 'Python was not found. Install Python 3.11+ and ensure py is on PATH.'
    }
    & $pythonLauncher.Source -3 -m venv $virtualEnvironment
    if ($LASTEXITCODE -ne 0) {
        throw 'Failed to create the backend virtual environment.'
    }
}

Write-Host 'Installing backend Python dependencies...'
& $pythonExecutable -m pip install -r (Join-Path $backendDirectory 'requirements.txt')
if ($LASTEXITCODE -ne 0) {
    throw 'Backend dependency installation failed.'
}

Write-Host 'Installing APRS/SSTV radio dependencies...'
& $pythonExecutable -m pip install -r (Join-Path $backendDirectory 'app\radio_lab\requirements.txt')
if ($LASTEXITCODE -ne 0) {
    throw 'Radio dependency installation failed.'
}
& $pythonExecutable -m pip install --no-deps 'open-sstv @ git+https://github.com/bucknova/Open-SSTV.git@d05de1dd1efe8a7ae45bf2618fd1d37a77d03184'
if ($LASTEXITCODE -ne 0) {
    throw 'Open-SSTV decoder installation failed.'
}

Write-Host 'Installing frontend npm dependencies...'
Push-Location $frontendDirectory
try {
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) {
        throw 'Frontend dependency installation failed.'
    }
}
finally {
    Pop-Location
}

$applyMigrations = Read-Host 'Apply pending database migrations now? Back up the database before schema changes. [y/N]'
if ($applyMigrations -notmatch '^(y|yes)$') {
    throw 'Startup cancelled. Apply migrations with DATABASE_URL set, then run this script again.'
}

Write-Host 'Applying database migrations...'
Push-Location $backendDirectory
try {
    & $pythonExecutable -m alembic -c alembic.ini upgrade head
    if ($LASTEXITCODE -ne 0) {
        throw 'Database migration failed; the API and frontend were not started.'
    }
}
finally {
    Pop-Location
}

$apiCommand = 'Set-Location -LiteralPath ' +
    (ConvertTo-PowerShellLiteral $backendDirectory) +
    '; & ' + (ConvertTo-PowerShellLiteral $pythonExecutable) +
    ' -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000'
$frontendCommand = 'Set-Location -LiteralPath ' +
    (ConvertTo-PowerShellLiteral $frontendDirectory) +
    '; $env:VITE_OPERATIONAL_DATA_SOURCE = ''api''; npm.cmd run dev'

Start-PowerShellWindow -WorkingDirectory $backendDirectory -Command $apiCommand
Start-PowerShellWindow -WorkingDirectory $frontendDirectory -Command $frontendCommand

Write-Host ''
Write-Host 'SAFER 247 startup commands launched in separate PowerShell windows.'
Write-Host 'Frontend: http://localhost:3000'
Write-Host 'API docs: http://127.0.0.1:8000/docs'
Write-Host 'The API manages the radio receiver when RADIO_ENABLED=true.'
