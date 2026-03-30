## ADDED Requirements

### Requirement: Provider usage data is normalized for shared display
The system SHALL normalize Codex and Claude usage data into a shared internal model suitable for the expanded panel and compact widget.

#### Scenario: Provider data is ingested successfully
- **WHEN** a provider adapter reads its source usage data
- **THEN** the system converts the provider data into the shared internal usage model
- **AND** the normalized output is usable by both display modes without provider-specific UI branching

### Requirement: Normalized data includes session and weekly fields
The shared internal usage model SHALL include provider identity, `Session` usage, `Weekly` usage, reset timing, and freshness information.

#### Scenario: Provider normalization completes
- **WHEN** the system finishes normalizing a provider result
- **THEN** the normalized result includes the provider name
- **AND** the normalized result includes session percentage, weekly percentage, reset timing labels, and a freshness indicator

### Requirement: Provider ingestion handles partial failures
The system SHALL support one provider failing independently without preventing the other provider from being displayed.

#### Scenario: One provider fails and the other succeeds
- **WHEN** one provider adapter returns an error or unavailable state
- **THEN** the system still displays the successful provider
- **AND** the failed provider is represented with an unavailable or stale state

### Requirement: Provider ingestion remains local-first in v1
The system SHALL prefer local or app-exposed machine-readable sources for Codex and Claude usage in v1.

#### Scenario: Local usage source is available
- **WHEN** a provider exposes a local or app-readable usage source
- **THEN** the system reads usage from that local-first source for v1
