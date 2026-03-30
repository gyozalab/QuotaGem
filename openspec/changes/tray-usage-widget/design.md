## Context

This change introduces a personal desktop utility for checking current usage across Codex Desktop and Claude Desktop from a single place. The current workflow requires opening separate tools or pages to inspect each provider's `Session` and `Weekly` usage, which creates unnecessary context switching for a lightweight status check.

The initial product direction is informed by the approved visual concept from Stitch. The v1 experience includes two desktop surfaces: an expanded panel opened from a tray icon and a compact widget shown in the bottom-right corner. Both surfaces use the same glass-style visual language and show the same core usage concepts with different information density.

The target environment is Windows desktop first. The utility should feel lightweight, local-first, and fast to open. Because Codex and Claude expose usage differently, the design needs a provider abstraction layer that can normalize both sources into one consistent UI model without forcing the interface to mirror either provider's internal terminology.

## Goals / Non-Goals

**Goals:**
- Provide a Windows tray utility with a single entry point for Codex and Claude usage.
- Support two v1 presentation modes: expanded panel and compact widget.
- Display provider usage using the user-facing terms `Session` and `Weekly`.
- Normalize provider-specific usage data into one shared UI model.
- Keep the utility local-first, lightweight, and optimized for quick glanceability.
- Include basic controls for refresh, mode switching, and settings access.

**Non-Goals:**
- Full historical analytics, charts, or long-term reporting in v1.
- Cross-platform parity in v1 outside Windows.
- Deep account management, login flows, or cloud syncing in v1.
- Editing provider settings or account quotas from inside the widget.
- Reproducing every detail from Codex or Claude's native usage pages.

## Decisions

### Decision 1: Build the app as a Windows-first desktop tray utility

The utility will be implemented as a desktop app with system tray integration, transparent window support, and bottom-right anchored surfaces. This matches the interaction model shown in the approved concepts and keeps usage access one click away.

Alternative considered:
- Browser extension or standalone web page: easier for generic UI delivery, but weaker system tray integration and a less native desktop feel.
- Terminal UI: simpler for engineering, but not aligned with the desired always-available visual widget experience.

### Decision 2: Support both display modes in v1 using a shared presentation model

The expanded panel and compact widget will ship together in v1. Both views will render from the same normalized provider usage model so the compact mode is not a separate product path. The expanded panel prioritizes readability and utility controls; the compact widget prioritizes persistent glanceable status.

Alternative considered:
- Shipping only the expanded panel first: lower implementation complexity, but it would miss a core user need that was explicitly requested as part of the first useful version.

### Decision 3: Use a provider adapter layer to normalize Codex and Claude usage

The app will define a common internal usage model for display, with provider-specific adapters responsible for reading and translating source data into that model. This isolates provider differences and allows the UI to stay stable even if one provider's source format changes.

The normalized model should include, at minimum:
- provider name
- provider health / availability state
- session percentage
- weekly percentage
- session reset label
- weekly reset label
- last updated timestamp

Alternative considered:
- Reading provider data directly inside UI components: faster for initial coding, but harder to test, maintain, and extend when provider formats diverge.

### Decision 4: Standardize user-facing terminology as `Session` and `Weekly`

Even if Codex internally reports rate windows such as `5 hours` and `1 week`, the v1 UI will present both providers using the more intuitive labels `Session` and `Weekly`. This favors clarity and consistency over exposing raw provider terminology.

Alternative considered:
- Preserving provider-native terms: more technically exact, but makes the interface feel inconsistent and harder to scan across providers.

### Decision 5: Prefer local-first data access and surface provider availability explicitly

The app should first rely on local or app-exposed usage sources available on the user's machine. If a provider source is unavailable, the UI should show a clear unavailable or stale state instead of hiding the provider entirely. This keeps the utility transparent and dependable.

Alternative considered:
- Requiring sign-in and remote API integration for all providers: potentially more canonical, but adds setup friction and is disproportionate for a personal quick-glance utility.

### Decision 6: Treat the Stitch concepts as visual direction, not pixel-perfect implementation lock

The Stitch outputs establish the intended visual language, placement, and information hierarchy, but implementation may adapt spacing, typography, iconography, and interaction details to fit the actual desktop shell and engineering constraints.

Alternative considered:
- Reproducing the Stitch output exactly: desirable visually, but brittle if the generated composition conflicts with desktop behavior or data density needs.

## Risks / Trade-offs

- [Claude usage source may not be as directly accessible as Codex local data] -> Define the provider layer early and allow a partial v1 implementation where Codex works first and Claude degrades gracefully if its source is not yet resolved.
- [Transparent/glass UI can reduce readability] -> Use conservative contrast, blur, border, and shadow values; validate against both dark and light desktop backgrounds.
- [Two display modes in v1 increase scope] -> Share one normalized data model and one visual token system so only the surface layout differs.
- [Tray and compact-window behavior can be platform-sensitive] -> Scope implementation to Windows first and document platform-specific assumptions in code and settings.
- [Provider formats may change over time] -> Keep parsing logic isolated behind provider adapters and add sample-based tests around normalization.

## Migration Plan

1. Establish the project scaffold for a Windows tray utility.
2. Implement the normalized usage model and provider adapter interfaces.
3. Implement Codex ingestion against the current local data source.
4. Implement Claude ingestion against its selected source.
5. Build the expanded panel UI using the approved visual direction.
6. Build the compact widget using the same visual tokens and data model.
7. Add tray behavior, refresh, mode switching, and settings entry points.
8. Validate the utility with real local usage data and refine fallback states.

Rollback strategy:
- If one provider integration is unstable, disable that provider adapter while preserving the rest of the utility.
- If compact mode causes release risk, keep the underlying shared model and temporarily hide only the compact surface behind a feature flag during development.

## Open Questions

- What is the preferred Claude usage source for v1: local app data, browser/session-derived source, or another desktop-readable source?
- Should the compact widget support click-through expansion into the main panel, or remain informational only?
- Should refresh be automatic on a timer in addition to manual refresh, and if so what interval is acceptable for v1?
- Should the tray icon visually indicate provider warning or stale data states, or stay static in v1?
