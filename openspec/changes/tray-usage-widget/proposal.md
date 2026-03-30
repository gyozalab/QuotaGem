## Why

I currently subscribe to both Codex Desktop and Claude Desktop, but checking their current session and weekly usage requires opening separate pages in each tool. This makes a simple "how much quota do I have left right now?" question unnecessarily slow and interrupts normal workflow.

I want a lightweight desktop utility that can be opened from the system tray and show both Codex and Claude usage in one place. This creates a faster, lower-friction way to check remaining usage and reduces context switching between tools.

## What Changes

- Add a desktop tray utility that displays Codex and Claude usage from a single entry point.
- Add an expanded panel view that opens from the tray icon and shows both providers in one unified interface.
- Add a compact widget mode in v1 for users who want a smaller, lower-obstruction surface in the bottom-right corner.
- Add usage presentation for each provider using straightforward `Session` and `Weekly` terminology, with remaining/reset timing.
- Add local provider-specific usage ingestion so the widget can read the current usage state for Codex and Claude from their available local or app-exposed sources.
- Add lightweight utility controls such as refresh, mode switching, and settings entry points.

## Capabilities

### New Capabilities
- `unified-usage-panel`: Provide a single tray-opened panel that shows current usage for both Codex and Claude in one interface.
- `compact-pinned-widget`: Provide a smaller compact mode in v1 that keeps essential usage information visible in the bottom-right corner.
- `provider-usage-ingestion`: Read and normalize usage information from Codex and Claude so both providers can be displayed consistently in the widget.
- `tray-widget-controls`: Provide tray launch behavior and basic utility actions such as refresh, mode switching, and settings access.

### Modified Capabilities

## Impact

- New desktop UI surface for a tray icon, expanded glass-style panel, and compact widget.
- Provider-specific usage readers/parsers for Codex and Claude data sources.
- Local state management for display mode, refresh behavior, and user preferences.
- Desktop shell integration for system tray behavior, transparent window styling, and bottom-right placement behavior.
