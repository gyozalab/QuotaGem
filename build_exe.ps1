$env:ELECTRON_CACHE = Join-Path $env:USERPROFILE ".cache\electron"
$env:ELECTRON_BUILDER_CACHE = Join-Path $env:USERPROFILE ".cache\electron-builder"
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"

New-Item -ItemType Directory -Force -Path $env:ELECTRON_CACHE, $env:ELECTRON_BUILDER_CACHE | Out-Null

Remove-Item -LiteralPath ".\dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath ".\dist-electron" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath ".\release" -Recurse -Force -ErrorAction SilentlyContinue

.\node_modules\.bin\tsc.cmd -b
.\node_modules\.bin\vite.cmd build
.\node_modules\.bin\electron-builder.cmd --win --x64