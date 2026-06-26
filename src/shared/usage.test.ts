import type { ProviderUsageSnapshot } from "./usage";

describe("normalizeProviderUsage", () => {
  it("creates the shared display model for a provider snapshot", async () => {
    const usageModule = await import("./usage");
    const normalizeProviderUsage = Reflect.get(
      usageModule,
      "normalizeProviderUsage",
    );

    expect(typeof normalizeProviderUsage).toBe("function");

    if (typeof normalizeProviderUsage !== "function") {
      return;
    }

    const snapshot: ProviderUsageSnapshot = {
      provider: "codex",
      displayName: "Codex",
      sessionPercent: 42,
      sessionResetAt: "2026-01-25T05:00:00.000Z",
      weeklyPercent: 18,
      weeklyResetAt: "2026-01-31T13:20:00.000Z",
      lastUpdated: "2026-03-28T02:00:00.000Z",
    };

    expect(
      normalizeProviderUsage(snapshot, {
        language: "en",
        timeDisplay: "utc",
        timeFormat: "24h",
      }),
    ).toEqual({
      provider: "codex",
      displayName: "Codex",
      health: "available",
      session: {
        label: "Session",
        percent: 42,
        resetLabel: "2026-01-25 05:00 UTC",
        level: "normal",
      },
      weekly: {
        label: "Weekly",
        percent: 18,
        resetLabel: "2026-01-31 13:20 UTC",
        level: "normal",
      },
      lastUpdated: "2026-03-28T02:00:00.000Z",
    });
  });

  it("formats reset time in local 12-hour mode when requested", async () => {
    const usageModule = await import("./usage");
    const normalizeProviderUsage = Reflect.get(
      usageModule,
      "normalizeProviderUsage",
    );

    expect(typeof normalizeProviderUsage).toBe("function");

    if (typeof normalizeProviderUsage !== "function") {
      return;
    }

    const snapshot: ProviderUsageSnapshot = {
      provider: "claude",
      displayName: "Claude",
      sessionPercent: 12,
      sessionResetAt: "2026-03-29T13:40:00.000Z",
      weeklyPercent: 80,
      weeklyResetAt: "2026-04-03T06:18:00.000Z",
      lastUpdated: "2026-03-28T02:00:00.000Z",
    };

    const normalized = normalizeProviderUsage(snapshot, {
      language: "en",
      timeDisplay: "utc",
      timeFormat: "12h",
    });

    expect(normalized.session.resetLabel).toBe("2026-03-29 01:40 PM UTC");
    expect(normalized.weekly.level).toBe("warning");
  });

  it("supports alternate date formats for reset labels", async () => {
    const usageModule = await import("./usage");
    const normalizeProviderUsage = Reflect.get(
      usageModule,
      "normalizeProviderUsage",
    );

    expect(typeof normalizeProviderUsage).toBe("function");

    if (typeof normalizeProviderUsage !== "function") {
      return;
    }

    const snapshot: ProviderUsageSnapshot = {
      provider: "codex",
      displayName: "Codex",
      sessionPercent: 42,
      sessionResetAt: "2026-01-25T05:00:00.000Z",
      weeklyPercent: 18,
      weeklyResetAt: "2026-01-31T13:20:00.000Z",
      lastUpdated: "2026-03-28T02:00:00.000Z",
    };

    const normalized = normalizeProviderUsage(snapshot, {
      language: "en",
      timeDisplay: "utc",
      timeFormat: "24h",
      dateFormat: "mdy",
    });

    expect(normalized.session.resetLabel).toBe("01/25/2026 05:00 UTC");
    expect(normalized.weekly.resetLabel).toBe("01/31/2026 13:20 UTC");
  });

  it("uses custom warning and danger thresholds when calculating usage levels", async () => {
    const usageModule = await import("./usage");
    const normalizeProviderUsage = Reflect.get(
      usageModule,
      "normalizeProviderUsage",
    );

    expect(typeof normalizeProviderUsage).toBe("function");

    if (typeof normalizeProviderUsage !== "function") {
      return;
    }

    const snapshot: ProviderUsageSnapshot = {
      provider: "claude",
      displayName: "Claude",
      sessionPercent: 66,
      sessionResetAt: "2026-03-29T13:40:00.000Z",
      weeklyPercent: 88,
      weeklyResetAt: "2026-04-03T06:18:00.000Z",
      lastUpdated: "2026-03-28T02:00:00.000Z",
    };

    const normalized = normalizeProviderUsage(snapshot, {
      language: "en",
      timeDisplay: "utc",
      timeFormat: "24h",
      warningThreshold: 60,
      dangerThreshold: 85,
    });

    expect(normalized.session.level).toBe("warning");
    expect(normalized.weekly.level).toBe("danger");
  });
});
