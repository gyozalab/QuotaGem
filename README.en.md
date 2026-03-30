# QuotaGem

[繁體中文](README.md) | English

A Windows tray app for checking `Claude` and `Codex` usage from one place.

## Features

- Tray-based desktop app with **expanded** and **compact** panels
- Show both providers together or only `Claude` / `Codex`
- Quota-aware progress colors with customizable warning and danger thresholds
- Background usage notifications for session and weekly usage
- `Connect Claude` login flow
- Panel personalization:
  - theme
  - transparency
  - scale
  - language
  - time format
  - date format
- Optional **Launch on Windows sign-in** preference

## Current Status

The core tray experience is working:

- One visible panel at a time
- Compact and expanded panel switching
- Top-most panel behavior
- Hide semantics instead of fake app quit semantics
- Codex JSONL parsing with malformed-line tolerance
- Dynamic expanded panel height
- QuotaGem branding assets and tray/header marks

## Tech Stack

- `Electron`
- `React`
- `TypeScript`
- `Vite`
- `electron-store`
- `Vitest`
- `Testing Library`

## Getting Started

```powershell
npm install
npm run dev
```

## Verification

```powershell
npm test
npm run build
```

## Project Structure

- `src/main` — Electron main process, tray wiring, provider orchestration
- `src/renderer` — React UI, panel rendering, settings, theme styling
- `src/providers` — Claude and Codex usage readers
- `src/shared` — shared state, usage formatting, i18n, panel theme helpers
- `public` — tray and brand assets

## Notes

- This project is **Windows-first**.
- Launch-at-login exists in the app, but packaged-build verification is still pending.
- Claude add-on usage support is not implemented yet.

## Development Pitfall

Do not allow generated `.js` or `.d.ts` files to reappear inside `src/`.

This project previously had stale compiled files in `src/` that caused old code to be loaded instead of the real `.ts` sources.
