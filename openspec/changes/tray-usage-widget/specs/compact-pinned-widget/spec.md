## ADDED Requirements

### Requirement: Compact widget mode is available in v1
The system SHALL provide a compact widget mode that appears in the bottom-right corner of the desktop.

#### Scenario: User enables compact widget mode
- **WHEN** the user switches from the expanded panel to compact mode
- **THEN** the system shows the compact widget in the bottom-right corner
- **AND** only the compact widget remains visible until the user switches back or hides the panel

### Requirement: Compact widget shows essential usage only
The compact widget SHALL present a reduced-information view of Codex and Claude that remains glanceable and lower obstruction than the expanded panel.

#### Scenario: Compact widget is visible
- **WHEN** the compact widget is rendered
- **THEN** the widget shows both Codex and Claude
- **AND** each provider shows essential `Session` and `Weekly` usage information without the full expanded panel controls

### Requirement: Compact widget follows the shared glass visual style
The compact widget SHALL use the same glass-style visual language as the expanded panel while reducing size and detail density.

#### Scenario: Compact widget is rendered
- **WHEN** the compact widget becomes visible
- **THEN** the widget uses a translucent glass-style surface
- **AND** the widget remains visually legible against the desktop background

### Requirement: Compact widget can lead back to the main experience
The system SHALL allow the user to reach the main usage interface from the compact widget.

#### Scenario: User wants more detail from compact widget
- **WHEN** the user activates the compact widget
- **THEN** the system opens or focuses the expanded usage panel
