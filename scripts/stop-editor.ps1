$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$pidPath = Join-Path $projectRoot 'data\editor.pid'
$serverFile = Join-Path $projectRoot 'server\index.ts'

if (-not (Test-Path -LiteralPath $pidPath)) { exit 0 }
$storedPid = [int](Get-Content -LiteralPath $pidPath -Raw)
$process = Get-CimInstance Win32_Process -Filter "ProcessId = $storedPid" -ErrorAction SilentlyContinue

if ($process) {
  $normalizedCommand = ($process.CommandLine -replace '/', '\')
  if ($normalizedCommand -notlike "*$serverFile*") {
    throw "O PID salvo não pertence ao Editor MP4; nenhum processo foi encerrado."
  }
  Stop-Process -Id $storedPid
}

Remove-Item -LiteralPath $pidPath -Force
