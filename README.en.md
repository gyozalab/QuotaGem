# QuotaGem

[繁體中文](./README.md) | English

A Windows tray app for keeping `Claude`, `Codex`, and `Antigravity` usage visible without living in browser tabs.

With QuotaGem, you can quickly check:

- current usage
- five-hour (session) and weekly status
- reset times
- warning and danger thresholds

<img src="./docs/images/expanded-panel.png" alt="QuotaGem expanded panel" width="66%" />

## What's New in 2.0

- 🆕 Added `Antigravity` as a third provider, auto-split into `Gemini` and `Claude and GPT` tracks
- 🔄 Compact panel redesigned as rings, surfacing five-hour usage (weekly on hover)
- 🛡️ Single-instance protection: reopening or autostart never spawns a second window
- 📦 Rewritten on Tauri 2 with a portable build, smaller and lighter on memory
- 🚀 Launch-at-login tracks the current `quotagem.exe` path, so moving the portable app only requires running it once from the new location

## Screenshots

> When refreshing README images, follow the filename and capture-state checklist in [README screenshot guide](./docs/screenshot-guide.md).

### Compact panel

<img src="./docs/images/compact-panel.png" alt="QuotaGem compact panel" width="66%" />

### Single-provider view

<p>
  <img src="./docs/images/only-claude.png" alt="QuotaGem Claude-only view" width="49%" />
  <img src="./docs/images/only-codex.png" alt="QuotaGem Codex-only view" width="49%" />
</p>

### Settings panel

<img src="./docs/images/settings-panel.png" alt="QuotaGem settings panel" width="66%" />

### Light theme

<img src="./docs/images/expanded-panel-white.png" alt="QuotaGem light expanded panel" width="66%" />

### Tray icon

<img src="./docs/images/tray-icon-list.png" alt="QuotaGem tray icon" width="66%" />

## What It Offers

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

## Why It Exists

QuotaGem is meant for a simple problem:

when you use AI tools heavily, you should not discover your limits too late.

It is not trying to be a giant dashboard or a management suite.  
It is a small desktop companion that stays nearby and tells you what matters at a glance.

Under the hood it is built on Tauri (Rust + the system WebView2), so the installer is a few MB and it sips memory while sitting in your tray all day.

## Download

Go to the [Releases](https://github.com/gyozalab/QuotaGem/releases) page and download the latest portable package (`QuotaGem_*_x64-portable.zip`). Extract it, run `quotagem.exe`, and enable launch-at-login from the settings panel if you want QuotaGem to start with Windows.

The portable build is the recommended Windows artifact until the installer is code-signed and its Microsoft Defender reputation is settled. Launch-at-login points to the current `quotagem.exe` path; if you move the app, run it once from the new location to refresh the Windows startup entry.

## For Developers

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
