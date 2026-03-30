# QuotaGem

[繁體中文](./README.md) | English

A Windows tray app for keeping `Claude` and `Codex` usage visible without living in browser tabs.

With QuotaGem, you can quickly check:

- current usage
- session and weekly status
- reset times
- warning and danger thresholds

![QuotaGem expanded panel](./docs/images/expanded-panel.png)

## Screenshots

### Compact panel

![QuotaGem compact panel](./docs/images/compact-panel.png)

### Settings panel

![QuotaGem settings panel](./docs/images/settings-panel.png)

### Light theme

![QuotaGem light expanded panel](./docs/images/expanded-panel-white.png)

### Tray icon

![QuotaGem tray icon](./docs/images/tray-icon-list.png)

## What It Offers

- A calm tray-first experience
- `expanded` and `compact` panels
- Unified view for `Claude` and `Codex`
- Single-provider view when you want less noise
- Custom warning and danger thresholds
- Background notifications
- Theme, transparency, and scale controls
- Built-in `Connect Claude` flow

## Why It Exists

QuotaGem is meant for a simple problem:

when you use AI tools heavily, you should not discover your limits too late.

It is not trying to be a giant dashboard or a management suite.  
It is a small desktop companion that stays nearby and tells you what matters at a glance.

## Quick Start

```powershell
Set-Location 'D:\coding\projects\QuotaGem'
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

For implementation details and handoff notes, see [`HANDOFF.md`](./HANDOFF.md).
