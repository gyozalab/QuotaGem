# QuotaGem

[繁體中文](./README.md) | English

<img src="./docs/images/cover.png" alt="QuotaGem" width="100%" />

A Windows tray app for keeping `Claude`, `Codex`, and `Antigravity` usage visible without living in browser tabs.

It helps you check:

- current usage
- five-hour (session) and weekly status
- reset times
- warning and danger thresholds

## What's New in 2.0

- 🆕 Added `Antigravity` as a third provider, auto-split into `Gemini` and `Claude and GPT` tracks
- 🔄 Compact panel redesigned as rings, surfacing five-hour usage (weekly on hover)
- 🛡️ Single-instance protection: reopening or autostart never spawns a second window
- 📦 Rewritten on Tauri 2 with a portable build, smaller and lighter on memory
- 🚀 Launch-at-login tracks the current `quotagem.exe` path, so moving the portable app only requires running it once from the new location

## Screenshots

### Expanded panel

<img src="./docs/images/expanded-panel.png" alt="QuotaGem expanded panel showing Claude, Codex, and Antigravity usage" width="66%" />

### Compact panel

<img src="./docs/images/compact-panel.png" alt="QuotaGem compact panel with ring design for all three providers; Antigravity uses a split ring" width="66%" />

### Warning and danger alerts

<img src="./docs/images/expanded-panel-alerts.png" alt="QuotaGem expanded panel showing warning and danger threshold alerts" width="66%" />

### Settings Panel

<img src="./docs/images/settings-panel.png" alt="QuotaGem settings panel" width="66%" />

### Light Theme

<p>
  <img src="./docs/images/expanded-panel-white.png" alt="QuotaGem light expanded panel" width="49%" />
  <img src="./docs/images/compact-panel-white.png" alt="QuotaGem light compact panel" width="49%" />
</p>

### Tray Icon

<img src="./docs/images/tray-icon-list.png" alt="QuotaGem tray icon" width="33%" />

## Data Sources

- A calm tray-first experience
- `expanded` and `compact` panels
- Unified view for `Claude`, `Codex`, and `Antigravity`
- `Antigravity` is split into `Gemini` and `Claude and GPT` usage groups
- Show only the providers you care about
- The compact panel surfaces your five-hour usage, with weekly on hover
- Custom warning and danger thresholds
- Background notifications
- Theme, transparency, and scale controls
- Launch at login, waking up with Windows
- English and Traditional Chinese UI
- Built-in `Connect Claude` flow

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

Under the hood it is built on Tauri (Rust + the system WebView2), so the installer is a few MB and it sips memory while sitting in your tray all day.

## Download

Go to the [Releases](https://github.com/gyozalab/QuotaGem/releases) page and download the latest portable package (`QuotaGem_*_x64-portable.zip`). Extract it, run `quotagem.exe`, and enable launch-at-login from the settings panel if you want QuotaGem to start with Windows.

The portable build is the recommended Windows artifact until the installer is code-signed and its Microsoft Defender reputation is settled. Launch-at-login points to the current `quotagem.exe` path; if you move the app, run it once from the new location to refresh the Windows startup entry.

```text
QuotaGem_2.0.0_x64-portable.zip
```

Extract it and run `quotagem.exe`. To start QuotaGem with Windows, enable launch-at-login from the settings panel.

For now, download the portable zip. Installer builds are not the recommended download yet.

## Development

QuotaGem 2.0 is built with Tauri 2, Rust, React, and TypeScript.

Built with Tauri 2 (Rust + React). You need the Rust toolchain and Node.js installed.

```powershell
git clone https://github.com/gyozalab/QuotaGem.git
cd QuotaGem
npm install
npx tauri dev      # development
npx tauri build    # build the app and Windows bundles
npm run package:portable
```

## Status

The Tauri 2.0 rewrite is feature-complete: all three providers, both panels, settings, alerts, themes, i18n, launch-at-login, and single-instance startup protection are in place. Portable zip is the recommended release artifact for now; MSI/NSIS installers are built but should wait for signing and Defender false-positive review before being promoted as the default download.
