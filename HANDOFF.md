# QuotaGem Handoff

Last updated: 2026-03-30

## Project Summary

This is a Windows-first Electron tray app for viewing `Claude` and `Codex` usage in one place.

Current design direction:
- Glassmorphism, dark translucent panels
- Two panel sizes: `expanded` and `compact`
- Only one panel is shown at a time
- Opening a panel keeps it on top
- Panel action uses `hide/minimize` semantics, not a fake close/quit

## Tech Stack

- `Electron`
- `React`
- `TypeScript`
- `Vite`
- `Vitest` + `Testing Library`
- `electron-store`

## What Is Working

### Core app behavior
- Tray-based desktop app with expanded panel and compact panel
- Expanded and compact panels can switch to each other
- Only one panel is visible at a time
- Panel control uses `Hide panel` / `收起面板`
- Preferred default panel can be selected in settings
- Expanded panel height now shrinks dynamically based on visible content

### Provider support
- `Codex` usage works by reading the latest JSONL session data from:
  - `%USERPROFILE%\\.codex\\sessions`
- `Claude` usage works through:
  - login window flow (`Connect Claude`)
  - session cookie reuse inside Electron
  - Claude usage API parsing

### Settings currently available
- Language: `English` / `繁體中文`
- Preferred panel: `Expanded panel` / `大面板`, `Compact panel` / `小面板`
- Provider visibility:
  - `Claude + Codex`
  - `Claude only` / `只顯示 Claude`
  - `Codex only` / `只顯示 Codex`
- Launch on Windows sign-in
- Refresh interval
- Notification on/off
- Notification mode: all alerts or danger-only
- Warning threshold
- Danger threshold
- Reset time timezone
- Time display format
- Panel transparency
- Panel background color

### Notifications
- Usage warning notifications now work on Windows
- Alerts are tracked separately for:
  - `Claude Session`
  - `Claude Weekly`
  - `Codex Session`
  - `Codex Weekly`
- Alerts respect the saved notification preferences:
  - enable/disable
  - all alerts vs danger-only
  - custom warning/danger thresholds
- The same threshold is not repeated unless usage drops below it first

### UI state
- Provider logos are integrated in both panels
- Progress bars use configurable thresholds for:
  - healthy
  - warning
  - danger
- Settings icon currently uses a `sliders / controls` style
  - This is a compromise choice; user did not love the gear attempts

## Most Important Files

- App state + settings UI:
  - [App.tsx](D:/coding/projects/tray-usage-widget/src/renderer/App.tsx)
- Panel UI:
  - [UsagePanel.tsx](D:/coding/projects/tray-usage-widget/src/renderer/UsagePanel.tsx)
- Styling:
  - [styles.css](D:/coding/projects/tray-usage-widget/src/renderer/styles.css)
- Main Electron behavior:
  - [main.ts](D:/coding/projects/tray-usage-widget/src/main/main.ts)
- Provider loading / Claude fetch pipeline:
  - [provider-service.ts](D:/coding/projects/tray-usage-widget/src/main/provider-service.ts)
- Launch at login behavior:
  - [launch-at-login.ts](D:/coding/projects/tray-usage-widget/src/main/launch-at-login.ts)
- Usage alert behavior:
  - [usage-alerts.ts](D:/coding/projects/tray-usage-widget/src/main/usage-alerts.ts)
- Claude parsing:
  - [claude.ts](D:/coding/projects/tray-usage-widget/src/providers/claude.ts)
- Codex parsing:
  - [codex.ts](D:/coding/projects/tray-usage-widget/src/providers/codex.ts)
- i18n strings:
  - [i18n.ts](D:/coding/projects/tray-usage-widget/src/shared/i18n.ts)
- Shared usage normalization:
  - [usage.ts](D:/coding/projects/tray-usage-widget/src/shared/usage.ts)
- Provider visibility filter:
  - [provider-visibility.ts](D:/coding/projects/tray-usage-widget/src/shared/provider-visibility.ts)

## How To Run

```powershell
Set-Location 'D:\coding\projects\tray-usage-widget'
npm run dev
```

## How To Verify

```powershell
Set-Location 'D:\coding\projects\tray-usage-widget'
npm test -- src/main/source-artifacts.test.ts src/main/launch-at-login.test.ts src/main/expanded-layout.test.ts src/main/usage-alerts.test.ts src/renderer/App.test.tsx src/renderer/UsagePanel.test.tsx src/providers/claude.test.ts src/providers/index.test.ts src/providers/codex.test.ts src/shared/usage.test.ts src/shared/i18n.test.ts src/shared/provider-visibility.test.ts
npm run build
```

Latest known-good verification:
- full targeted test suite passed
- build passed

## Important Pitfalls

### 1. Do not let compiled `.js` / `.d.ts` files come back into `src/`

This project previously had stale emitted files inside `src/`, especially under:
- `src/shared`
- `src/main`
- `src/providers`

Those files caused Vitest and imports to read old code instead of the real `.ts` source.

This was fixed by:
- deleting stale emitted files from `src/`
- setting `noEmit: true` in [tsconfig.node.json](D:/coding/projects/tray-usage-widget/tsconfig.node.json)

If weird behavior appears where the UI seems unchanged even after editing `.ts`, check for stale emitted files first.

### 2. README is outdated

[README.md](D:/coding/projects/tray-usage-widget/README.md) still describes an older state:
- mentions pin/unpin
- misses newer settings and UX changes

If someone resumes this project, trust `HANDOFF.md` and the current source more than `README.md`.

### 3. Claude integration is fragile by nature

Claude usage depends on:
- web login/session behavior
- hidden Electron window fetch flow
- current Claude API response shape
- extra paid / add-on usage is not implemented yet because we still need a real Claude payload sample that includes those fields

If Claude breaks again, start here:
- [provider-service.ts](D:/coding/projects/tray-usage-widget/src/main/provider-service.ts)
- [claude.ts](D:/coding/projects/tray-usage-widget/src/providers/claude.ts)

Debug note:
- Claude debug output now writes to the app `userData` folder as `claude-debug.json`, not to the project root.

### 4. Launch at login is only code-level verified so far

The `Launch on Windows sign-in` toggle is implemented and writes a Windows login item, but it has only been verified in code/tests so far.

Important nuance:
- In `dev` mode, Windows startup launches Electron without the Vite dev server, so startup can appear broken even though the login item was registered.
- Real end-to-end verification should happen on a packaged/installed build.

When preparing a release, explicitly test:
- toggle on in the packaged app
- sign out / reboot
- app launches into the tray correctly without a dev server

### 5. Packaging prep cleanup is still outstanding

Before this project is packaged for release or pushed as a polished GitHub repo, there is a cleanup/review pass that still needs to happen.

Current review notes:
- There is no real packaging pipeline yet.
  - [package.json](D:/coding/projects/tray-usage-widget/package.json) currently has `build`, but no `package` / `dist` script and no `electron-builder` / `electron-forge` configuration.
- The obvious `process.cwd()` runtime risks were cleaned up.
  - tray icon resolution now goes through packaged-app-safe runtime paths
  - Claude debug output now writes under app `userData`
- The obvious unused leftovers were cleaned up.
  - `time.ts` was removed
  - preload `openSettings()` IPC path was removed
  - old renderer-facing Claude manual credential fields were removed from shared preferences

Recommended packaging-prep cleanup order:
1. Add a real packaging tool and config (`electron-builder` or equivalent)
2. Finish trimming any remaining old Claude manual-credential copy that is no longer part of the product direction
3. Update [README.md](D:/coding/projects/tray-usage-widget/README.md) so GitHub matches the current product

## Current UX Decisions

These are intentional and should not be accidentally reverted:

- `Pin` buttons were removed
- Opening a panel should already feel "pinned/on-top"
- `X` was replaced by `Hide panel`
- Expanded/compact should switch between each other
- Only one panel should be visible at a time
- `Settings` includes the default panel choice

## Current User Requests Already Completed

- Traditional Chinese wording improved
- `Session / Weekly` in zh-TW became:
  - `5 小時`
  - `週用量`
- Local time wording became `本機時間`
- Provider-specific logos added
- Show only Claude / only Codex / both
- Settings text slightly reduced in size
- Sliders-style settings icon currently in use
- Launch-at-login toggle added
- Usage warning notifications added
- Custom warning/danger thresholds added
- Notification preferences added
- More panel themes added beyond the original three presets

## Outstanding Backlog

These items were discussed but not completed yet:

- More date format choices
- Better Taiwan-specific wording polish across all settings text
- Final app name
- Final app logo / tray icon polish
- Claude extra paid usage / add-on usage support
- Security review / threat model
- Better tray icon reliability and visual polish on Windows
- Packaged-build verification for launch at login
- Packaging-prep cleanup pass:
  - add real packaging config
  - finish trimming leftover obsolete copy
  - refresh `README.md`

## Suggested Next Priorities

Recommended next order:

1. Packaged-build verification for launch at login
2. Better Taiwan-specific wording polish across all settings text
3. More panel color themes
4. Final app name / logo
5. Claude add-on usage support

## Notes For The Next Conversation

If a future assistant continues this project, the fastest safe re-entry is:

1. Read this file first
2. Open:
   - [App.tsx](D:/coding/projects/tray-usage-widget/src/renderer/App.tsx)
   - [UsagePanel.tsx](D:/coding/projects/tray-usage-widget/src/renderer/UsagePanel.tsx)
   - [main.ts](D:/coding/projects/tray-usage-widget/src/main/main.ts)
   - [provider-service.ts](D:/coding/projects/tray-usage-widget/src/main/provider-service.ts)
   - [i18n.ts](D:/coding/projects/tray-usage-widget/src/shared/i18n.ts)
3. Run the targeted tests
4. Run `npm run build`
5. Continue from the next requested feature
