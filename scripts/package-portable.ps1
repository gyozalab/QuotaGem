param(
  [string]$Configuration = "release"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$tauriConfigPath = Join-Path $repoRoot "src-tauri\tauri.conf.json"
$tauriConfig = Get-Content -LiteralPath $tauriConfigPath -Raw | ConvertFrom-Json
$version = $tauriConfig.version

$exePath = Join-Path $repoRoot "src-tauri\target\$Configuration\quotagem.exe"
if (-not (Test-Path -LiteralPath $exePath)) {
  throw "Missing $exePath. Run 'npx tauri build' first."
}

$portableDir = Join-Path $repoRoot "src-tauri\target\$Configuration\bundle\portable"
New-Item -ItemType Directory -Force -Path $portableDir | Out-Null

$zipPath = Join-Path $portableDir "QuotaGem_${version}_x64-portable.zip"
Compress-Archive -LiteralPath $exePath -DestinationPath $zipPath -Force

Write-Host "Portable package created:"
Write-Host $zipPath
