# QuotaGem

[繁體中文](./README.md) | English

QuotaGem is a Windows tray utility for keeping `Claude`, `Codex`, and `Antigravity` usage visible at a glance.

It helps you check:

- current usage
- five-hour and weekly quota status
- reset times
- warning and danger thresholds

<img src="./docs/images/expanded-panel.png" alt="QuotaGem expanded panel" width="66%" />

## What's New in 2.0

- Rewritten on Tauri 2, with Rust handling the tray shell, windows, providers, notifications, and launch-at-login.
- Adds `Antigravity` as a provider, split into `Gemini` and `Claude and GPT` quota groups.
- Redesigns compact mode around usage rings, showing five-hour usage first and weekly usage in hover details and expanded mode.
- Uses full-row progress bars in expanded mode, with Antigravity shown per model group.
- Adds single-instance protection so reopening or autostart keeps only one QuotaGem process.
- Ships as a portable build: download the zip, extract it, and run `quotagem.exe`.

## Preview

### Compact Panel

<img src="./docs/images/compact-panel.png" alt="QuotaGem compact panel" width="66%" />

### Claude-only or Codex-only View

<p>
  <img src="./docs/images/only-claude.png" alt="QuotaGem Claude-only view" width="49%" />
  <img src="./docs/images/only-codex.png" alt="QuotaGem Codex-only view" width="49%" />
</p>

### Settings Panel

<img src="./docs/images/settings-panel.png" alt="QuotaGem settings panel" width="66%" />

### Light Theme

<img src="./docs/images/expanded-panel-white.png" alt="QuotaGem light expanded panel" width="66%" />

### Tray Icon

<img src="./docs/images/tray-icon-list.png" alt="QuotaGem tray icon" width="33%" />

## Data Sources

### Claude

QuotaGem uses the built-in `Connect Claude` flow to store the required session information, then reads Claude usage from the backend directly. Version 2.0 no longer depends on a hidden browser window.

### Codex

QuotaGem reads the newest local session record under `.codex/sessions`, finds the latest `token_count` event, and displays the current rate-limit state.

### Antigravity

QuotaGem detects the signed-in local Antigravity language server and calls a read-only quota summary RPC. It only reads quota data. It does not send prompts or consume model quota.

## Features

- Tray-first Windows experience with left-click panel toggling and a right-click menu.
- `compact` and `expanded` panel modes.
- Per-provider visibility controls for Claude, Codex, and Antigravity.
- Five-hour and weekly usage visualization.
- Custom warning and danger thresholds.
- Windows notifications, with all-alerts or danger-only modes.
- Cross-refresh alert deduplication.
- Automatic refresh and manual refresh.
- Dark and light themes.
- Transparency, scale, time format, and date format settings.
- Traditional Chinese and English UI languages.
- Launch-at-login support. For portable builds, running the moved exe once refreshes the startup path.

## Download

Go to the [Releases](https://github.com/gyozalab/QuotaGem/releases) page and download the latest portable package:

```text
QuotaGem_2.0.0_x64-portable.zip
```

Extract it and run `quotagem.exe`. To start QuotaGem with Windows, enable launch-at-login from the settings panel.

For now, download the portable zip. Installer builds are not the recommended download yet.

## Development

QuotaGem 2.0 is built with Tauri 2, Rust, React, and TypeScript.

```powershell
git clone https://github.com/gyozalab/QuotaGem.git
cd QuotaGem
npm install
npm run dev
```

## Build

```powershell
npm test
npm run build
npm run tauri:build
npm run package:portable
```

The portable zip is written to:

```text
src-tauri\target\release\bundle\portable\QuotaGem_2.0.0_x64-portable.zip
```
