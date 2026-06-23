# QuotaGem

English | [繁體中文](./README.zh-TW.md) | [简体中文](./README.zh-CN.md)

<img src="./docs/images/cover.png" alt="QuotaGem cover" width="60%" />

QuotaGem is a Windows tray utility for keeping AI usage visible at a glance. It monitors `Claude`, `Codex`, and Google `Antigravity` style usage surfaces, with support for local usage history where desktop data is available.

It is built for one quiet job: help you see quota pressure before you hit it.

## Preview

### Large Panel

<img src="./docs/images/expanded-panel.png" alt="QuotaGem large panel" width="66%" />

### Compact Panel

<img src="./docs/images/compact-panel.png" alt="QuotaGem compact panel" width="66%" />

### Focused Views

<p>
  <img src="./docs/images/only-claude.png" alt="QuotaGem Claude-only view" width="49%" />
  <img src="./docs/images/only-codex.png" alt="QuotaGem Codex-only view" width="49%" />
</p>

### Settings

<img src="./docs/images/settings-panel.png" alt="QuotaGem settings panel" width="66%" />

### Light Theme

<img src="./docs/images/expanded-panel-white.png" alt="QuotaGem light panel" width="66%" />

### Tray Entry

<img src="./docs/images/tray-icon-list.png" alt="QuotaGem tray entry" width="66%" />

## Features

- Tray-first Windows experience with quick open and hide behavior.
- Large and compact panels for different desktop layouts.
- Provider visibility filters: show all providers, only Claude, only Codex, or only Antigravity.
- Codex data source options: official data or local desktop data.
- Local usage history powered by `ccusage` where supported local files exist.
- Daily, weekly, monthly, and historical token/cost summaries.
- Recent 7-day usage chart with hover details.
- Optional remaining-usage display per provider.
- Configurable warning and danger thresholds.
- Notifications for usage pressure.
- Themes, scale, transparency, time format, date format, and language settings.
- English, Traditional Chinese, and Simplified Chinese UI language support.

## Data Sources

QuotaGem combines provider status with local history when available:

- `Claude`: usage status from the connected desktop/session flow, plus local history when compatible data exists.
- `Codex`: official data by default, with an optional local data source from the user's `.codex` directory.
- `Antigravity`: local usage detection where compatible data exists.
- Local token and cost summaries use `ccusage` model breakdowns when possible.

Local usage is read from files already present on your machine. QuotaGem does not need your model API keys for local history parsing.

## Download

Go to the [Releases](https://github.com/gyozalab/QuotaGem/releases) page and download the latest `QuotaGem-*.exe`.

The Windows build is portable: run the `.exe` directly.

## Development

```powershell
git clone https://github.com/gyozalab/QuotaGem.git
cd QuotaGem
npm install
npm run dev
```

## Build

```powershell
npm run build
.\node_modules\.bin\electron-builder.cmd --win --x64
```

The packaged output is written to `release/`.

## Notes

QuotaGem is an independent desktop utility. Provider names are used only to describe the usage surfaces the app helps you monitor.
