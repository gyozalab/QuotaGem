## 1. Project setup

- [x] 1.1 Confirm the target app workspace and runtime stack for the tray utility implementation
- [x] 1.2 Create or organize the desktop app structure for tray integration, provider adapters, and UI surfaces
- [x] 1.3 Add any required desktop app dependencies for tray behavior, transparent windows, and local settings

## 2. Shared usage model and provider ingestion

- [x] 2.1 Define the normalized internal usage model for provider name, session usage, weekly usage, reset timing, and freshness state
- [x] 2.2 Implement the Codex usage adapter against the current local data source
- [x] 2.3 Implement the Claude usage adapter against the selected v1 source
- [x] 2.4 Add fallback and stale-state handling so one provider can fail without blocking the other

## 3. Tray shell and expanded panel

- [x] 3.1 Implement the tray icon entry point and expanded panel open behavior
- [x] 3.2 Build the expanded glass-style panel layout for Codex and Claude usage sections
- [x] 3.3 Render `Session` and `Weekly` usage values, reset timing, and provider availability states in the expanded panel
- [x] 3.4 Add refresh, mode switching, and settings controls to the expanded panel

## 4. Compact widget

- [x] 4.1 Implement the compact widget window and bottom-right placement behavior
- [x] 4.2 Build the compact widget UI using the shared visual tokens and normalized provider model
- [x] 4.3 Add the interaction that opens or focuses the expanded panel from the compact widget

## 5. Settings and persistence

- [x] 5.1 Add local persistence for preferred display mode and refresh-related preferences
- [x] 5.2 Implement the settings entry point and basic v1 preferences surface

## 6. Verification and polish

- [x] 6.1 Validate provider normalization with sample data and failure cases
- [ ] 6.2 Verify tray behavior, expanded panel behavior, and compact widget behavior on Windows desktop
- [ ] 6.3 Verify readability of the glass UI against multiple desktop backgrounds
- [x] 6.4 Document any v1 limitations or provider-source caveats discovered during implementation
