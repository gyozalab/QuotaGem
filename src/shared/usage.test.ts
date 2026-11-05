import type { ProviderUsageSnapshot } from "./usage";

describe("normalizeProviderUsage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

    // 固定「現在」讓相對倒數可預期：session=+3h、weekly≈+6.5 天
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-25T02:00:00.000Z"));

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
        resetLabel: "in 3 hours",
        level: "normal",
      },
      weekly: {
        label: "Weekly",
        percent: 18,
        resetLabel: "in 6 days",
        level: "normal",
      },
      lastUpdated: "2026-03-28T02:00:00.000Z",
    });
  });

  it("formats reset time in local 12-hour mode when requested", async () => {
    const { formatResetDisplay } = await import("./usage");

    // 面板改用倒數後，絕對格式邏輯保留在 formatResetDisplay，直接測它。
    expect(
      formatResetDisplay("2026-03-29T13:40:00.000Z", "en", "utc", "12h"),
    ).toBe("2026-03-29 01:40 PM UTC");
  });

  it("supports alternate date formats for reset labels", async () => {
    const { formatResetDisplay } = await import("./usage");

    expect(
      formatResetDisplay("2026-01-25T05:00:00.000Z", "en", "utc", "24h", "mdy"),
    ).toBe("01/25/2026 05:00 UTC");
    expect(
      formatResetDisplay("2026-01-31T13:20:00.000Z", "en", "utc", "24h", "mdy"),
    ).toBe("01/31/2026 13:20 UTC");
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
