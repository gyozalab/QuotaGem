# QuotaGem

[繁體中文](./README.md) | English

A Windows tray app for keeping `Claude`, `Codex`, and `Antigravity` usage visible without living in browser tabs.

With QuotaGem, you can quickly check:

- current usage
- five-hour (session) and weekly status
- reset times
- warning and danger thresholds

<img src="./docs/images/expanded-panel.png" alt="QuotaGem expanded panel" width="66%" />

## Screenshots

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

Go to the [Releases](https://github.com/gyozalab/QuotaGem/releases) page and download the latest installer (`QuotaGem_*_x64-setup.exe` or `QuotaGem_*_x64_en-US.msi`), then follow the prompts. You can enable launch-at-login from the settings panel.

## For Developers

Built with Tauri 2 (Rust + React). You need the Rust toolchain and Node.js installed.

```powershell
git clone https://github.com/gyozalab/QuotaGem.git
cd QuotaGem
npm install
npx tauri dev      # development
npx tauri build    # package installers (MSI + NSIS)
```

## Status

The Tauri 2.0 rewrite is feature-complete: all three providers, both panels, settings, alerts, themes, i18n, and launch-at-login are in place and packaged as MSI/NSIS installers.
