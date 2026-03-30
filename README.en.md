# QuotaGem

[繁體中文](./README.md) | English

A Windows tray app for keeping `Claude` and `Codex` usage visible without living in browser tabs.

With QuotaGem, you can quickly check:

- current usage
- session and weekly status
- reset times
- warning and danger thresholds

<img src="./docs/images/expanded-panel.png" alt="QuotaGem expanded panel" width="66%" />

## Screenshots

### Compact panel

<img src="./docs/images/compact-panel.png" alt="QuotaGem compact panel" width="66%" />

### Claude-only or Codex-only view

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
- Unified view for `Claude` and `Codex`
- A dedicated `Claude`-only or `Codex`-only view when you want less noise
- Custom warning and danger thresholds
- Background notifications
- Theme, transparency, and scale controls
- Built-in `Connect Claude` flow

## Why It Exists

QuotaGem is meant for a simple problem:

when you use AI tools heavily, you should not discover your limits too late.

It is not trying to be a giant dashboard or a management suite.  
It is a small desktop companion that stays nearby and tells you what matters at a glance.

## Download

Go to the [Releases](https://github.com/gyozalab/QuotaGem/releases) page and download the latest `QuotaGem-*.exe`. Run it directly — no installation needed.

## For Developers

```powershell
git clone https://github.com/gyozalab/QuotaGem.git
cd QuotaGem
npm install
npm run dev
```

## Current Status

The core experience is already working:

- panel switching is in place
- QuotaGem branding is live
- notifications, thresholds, date formats, and panel scaling are done
- the project now lives in its own standalone repository

## Next Up

- prepare the Windows `.exe` packaging flow
- verify launch-at-login and tray behavior in the packaged app
- keep refining the experience based on real usage
