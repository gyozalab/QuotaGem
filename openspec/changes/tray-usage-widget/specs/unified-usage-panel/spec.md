## ADDED Requirements

### Requirement: Unified tray panel displays both providers
The system SHALL provide an expanded panel that opens from the tray icon and displays Codex and Claude usage within the same interface.

#### Scenario: Open tray panel from tray icon
- **WHEN** the user activates the tray icon
- **THEN** the system opens the expanded usage panel near the bottom-right area of the desktop
- **AND** the panel shows both Codex and Claude as separate provider sections

### Requirement: Expanded panel presents session and weekly usage
The expanded panel SHALL present each provider using the labels `Session` and `Weekly` with a percentage value and reset timing text.

#### Scenario: Provider usage is available
- **WHEN** provider usage data has been successfully loaded
- **THEN** the panel shows `Session` and `Weekly` values for that provider
- **AND** the panel shows the associated reset timing for each value

### Requirement: Expanded panel uses the approved visual hierarchy
The expanded panel SHALL preserve the approved v1 visual direction of a glass-style surface with low-obstruction presentation, provider grouping, and bottom utility controls.

#### Scenario: Expanded panel is rendered
- **WHEN** the expanded panel becomes visible
- **THEN** the panel uses a translucent glass-style surface
- **AND** usage information is grouped by provider
- **AND** utility controls remain visually separated from provider usage content

### Requirement: Expanded panel shows provider fallback states
The expanded panel SHALL show an explicit unavailable or stale state for a provider when current usage cannot be loaded.

#### Scenario: Provider data is unavailable
- **WHEN** a provider adapter cannot produce current usage data
- **THEN** the expanded panel keeps the provider visible
- **AND** the panel indicates that the provider's usage is unavailable or stale instead of omitting the provider
