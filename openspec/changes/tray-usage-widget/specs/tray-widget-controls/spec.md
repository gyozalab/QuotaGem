## ADDED Requirements

### Requirement: Tray icon launches the usage utility
The system SHALL provide a tray icon that serves as the primary entry point for the usage utility.

#### Scenario: Tray icon is available
- **WHEN** the desktop utility is running
- **THEN** the system shows a tray icon
- **AND** the tray icon can be used to open the expanded usage panel

### Requirement: User can refresh usage data
The system SHALL provide a refresh action that requests updated provider usage data.

#### Scenario: User triggers refresh
- **WHEN** the user activates the refresh control
- **THEN** the system requests fresh usage data from the available provider adapters
- **AND** the interface updates its freshness state when the request completes

### Requirement: User can switch between expanded and compact modes
The system SHALL provide controls to switch from the expanded panel to compact mode and back again.

#### Scenario: User opens compact mode from the expanded panel
- **WHEN** the user activates the compact mode control from the expanded panel
- **THEN** the system shows the compact widget

#### Scenario: User returns to the expanded panel
- **WHEN** the user activates the expanded mode control from the compact widget
- **THEN** the system focuses or opens the expanded usage panel

### Requirement: User can access settings entry point
The system SHALL provide a settings entry point from the expanded panel.

#### Scenario: User opens settings
- **WHEN** the user activates the settings control
- **THEN** the system opens the settings experience for the tray utility
