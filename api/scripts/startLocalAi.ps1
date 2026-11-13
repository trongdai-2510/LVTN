param(
  [string]$OllamaExe = '',
  [string]$ModelsDir = ''
)

$ErrorActionPreference = 'Stop'

if (-not $OllamaExe) {
  $installed = Get-Command ollama -ErrorAction SilentlyContinue
  if ($installed) {
    $OllamaExe = $installed.Source
  } elseif (Test-Path -LiteralPath 'D:\SongThanhLocalAI\runtime\ollama.exe') {
    $OllamaExe = 'D:\SongThanhLocalAI\runtime\ollama.exe'
  } else {
    throw 'Khong tim thay Ollama. Truyen -OllamaExe bang duong dan ollama.exe tren may chay API.'
  }
}

$OllamaExe = (Resolve-Path -LiteralPath $OllamaExe).Path
if (-not $ModelsDir) {
  if (Test-Path -LiteralPath 'D:\SongThanhLocalAI\models') {
    $ModelsDir = 'D:\SongThanhLocalAI\models'
  } else {
    $ModelsDir = Join-Path $env:LOCALAPPDATA 'SongThanhLocalAI\models'
  }
}

New-Item -ItemType Directory -Path $ModelsDir -Force | Out-Null
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_MODELS = (Resolve-Path -LiteralPath $ModelsDir).Path
$env:OLLAMA_NO_CLOUD = '1'

Write-Host "Ollama chi lang nghe tai $env:OLLAMA_HOST; model o $env:OLLAMA_MODELS."
Write-Host 'Giu cua so nay mo khi su dung tro ly. API can chay tren cung may.'
& $OllamaExe serve
