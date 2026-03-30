import { describe, expect, it } from "vitest";

import type { UsageDashboardState } from "../shared/dashboard";
import { createUsageAlertTracker } from "./usage-alerts";

function createState({
  sessionPercent = 10,
  weeklyPercent = 10,
  health = "available",
  language = "en",
  notificationsEnabled = true,
  notificationLevel = "all",
}: {
  sessionPercent?: number;
  weeklyPercent?: number;
  health?: "available" | "stale" | "unavailable";
  language?: "en" | "zh-TW";
  notificationsEnabled?: boolean;
  notificationLevel?: "all" | "danger";
} = {}): UsageDashboardState {
  return {
    providers: [
      {
        provider: "codex",
        displayName: "Codex",
        health,
        session: {
          label: "Session",
          percent: sessionPercent,
          resetLabel: "Soon",
          level:
            sessionPercent >= 90
              ? "danger"
              : sessionPercent >= 75
                ? "warning"
                : "normal",
        },
        weekly: {
          label: "Weekly",
          percent: weeklyPercent,
          resetLabel: "Later",
          level:
            weeklyPercent >= 90
              ? "danger"
              : weeklyPercent >= 75
                ? "warning"
                : "normal",
        },
        lastUpdated: "2026-03-30T10:00:00.000Z",
      },
    ],
    lastUpdatedLabel: "Updated just now",
    preferences: {
      preferredDisplayMode: "expanded",
      launchAtLogin: false,
      providerVisibility: "both",
      refreshIntervalMinutes: 5,
      warningThreshold: 75,
      dangerThreshold: 90,
      notificationsEnabled,
      notificationLevel,
      language,
      timeDisplay: "utc",
      timeFormat: "24h",
      dateFormat: "iso",
      panelScale: 100,
      panelOpacity: 90,
      panelTone: "charcoal",
    },
  };
}

describe("usage alerts", () => {
  it("emits a warning notification when usage first crosses 75 percent", () => {
    const tracker = createUsageAlertTracker();

    expect(tracker.consume(createState({ sessionPercent: 74 }))).toEqual([]);

    expect(tracker.consume(createState({ sessionPercent: 78 }))).toEqual([
      {
        body: "Codex Session usage reached 78%.",
        id: "codex:session",
        level: "warning",
        title: "QuotaGem",
      },
    ]);
  });

  it("does not repeat the same threshold notification", () => {
    const tracker = createUsageAlertTracker();

    tracker.consume(createState({ sessionPercent: 80 }));

    expect(tracker.consume(createState({ sessionPercent: 82 }))).toEqual([]);
  });

  it("emits a danger notification when usage later crosses 90 percent", () => {
    const tracker = createUsageAlertTracker();

    tracker.consume(createState({ sessionPercent: 82 }));

    expect(tracker.consume(createState({ sessionPercent: 91 }))).toEqual([
      {
        body: "Codex Session usage reached 91%.",
        id: "codex:session",
        level: "danger",
        title: "QuotaGem",
      },
    ]);
  });

  it("allows notifications again after usage drops back below the thresholds", () => {
    const tracker = createUsageAlertTracker();

    tracker.consume(createState({ sessionPercent: 80 }));
    tracker.consume(createState({ sessionPercent: 20 }));

    expect(tracker.consume(createState({ sessionPercent: 76 }))).toEqual([
      {
        body: "Codex Session usage reached 76%.",
        id: "codex:session",
        level: "warning",
        title: "QuotaGem",
      },
    ]);
  });

  it("ignores unavailable providers so temporary fetch failures do not retrigger alerts", () => {
    const tracker = createUsageAlertTracker();

    tracker.consume(createState({ sessionPercent: 80 }));
    tracker.consume(createState({ sessionPercent: 0, health: "unavailable" }));

    expect(tracker.consume(createState({ sessionPercent: 81 }))).toEqual([]);
  });

  it("does not emit notifications when notifications are disabled", () => {
    const tracker = createUsageAlertTracker();

    expect(
      tracker.consume(
        createState({
          sessionPercent: 91,
          notificationsEnabled: false,
        }),
      ),
    ).toEqual([]);
  });

  it("only emits danger notifications when danger-only mode is selected", () => {
    const tracker = createUsageAlertTracker();

    expect(
      tracker.consume(
        createState({
          sessionPercent: 80,
          notificationLevel: "danger",
        }),
      ),
    ).toEqual([]);

    expect(
      tracker.consume(
        createState({
          sessionPercent: 92,
          notificationLevel: "danger",
        }),
      ),
    ).toEqual([
      {
        body: "Codex Session usage reached 92%.",
        id: "codex:session",
        level: "danger",
        title: "QuotaGem",
      },
    ]);
  });
});
