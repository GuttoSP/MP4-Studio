$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$dataDirectory = Join-Path $projectRoot 'data'
$logDirectory = Join-Path $dataDirectory 'logs'
$pidPath = Join-Path $dataDirectory 'editor.pid'
$startupLog = Join-Path $logDirectory 'startup.log'
$stdoutLog = Join-Path $logDirectory 'server.stdout.log'
$stderrLog = Join-Path $logDirectory 'server.stderr.log'
$healthUri = 'http://127.0.0.1:43171/api/health'
$serverFile = Join-Path $projectRoot 'server\index.ts'

New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

try {
  $health = Invoke-RestMethod -Uri $healthUri -TimeoutSec 2
  if ($health.ok) { exit 0 }
} catch {}

if (-not (Test-Path (Join-Path $projectRoot 'node_modules\tsx'))) {
  'Dependências ausentes. Execute npm install na pasta do projeto.' | Set-Content -LiteralPath $startupLog -Encoding UTF8
  exit 1
}

if (-not (Test-Path (Join-Path $projectRoot 'dist\index.html'))) {
  Push-Location $projectRoot
  try {
    & npm.cmd run build *>> $startupLog
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } finally {
    Pop-Location
  }
}

$nodeExecutable = (Get-Command node.exe).Source
$serverProcess = Start-Process -FilePath $nodeExecutable `
  -ArgumentList @('--import', 'tsx', ('"{0}"' -f $serverFile)) `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog `
  -PassThru

$serverProcess.Id | Set-Content -LiteralPath $pidPath -Encoding ASCII

for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
  try {
    $health = Invoke-RestMethod -Uri $healthUri -TimeoutSec 2
    if ($health.ok) { exit 0 }
  } catch {}
  Start-Sleep -Milliseconds 250
}

if (-not $serverProcess.HasExited) { Stop-Process -Id $serverProcess.Id }
'O servidor não respondeu em http://127.0.0.1:43171. Consulte server.stderr.log.' | Set-Content -LiteralPath $startupLog -Encoding UTF8
exit 1
