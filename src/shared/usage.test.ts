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
        displayPercent: 42,
        percentLabel: "42%",
        barMode: "used",
        resetLabel: "2026-01-25 05:00 UTC",
        level: "normal",
      },
      weekly: {
        label: "Weekly",
        percent: 18,
        displayPercent: 18,
        percentLabel: "18%",
        barMode: "used",
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
    expect(normalized.session.percentLabel).toBe("12%");
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

  it("can format Codex as remaining usage without changing raw alert percentages", async () => {
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
      language: "zh-CN",
      timeDisplay: "utc",
      timeFormat: "24h",
      codexShowRemainingUsage: true,
    });

    expect(normalized.session.percent).toBe(42);
    expect(normalized.session.displayPercent).toBe(58);
    expect(normalized.session.percentLabel).toBe("剩余 58%");
    expect(normalized.session.barMode).toBe("remaining");
    expect(normalized.weekly.displayPercent).toBe(82);
  });

  it("can format non-Codex providers as remaining usage independently", async () => {
    const usageModule = await import("./usage");
    const normalizeProviderUsage = Reflect.get(
      usageModule,
      "normalizeProviderUsage",
    );

    expect(typeof normalizeProviderUsage).toBe("function");

    if (typeof normalizeProviderUsage !== "function") {
      return;
    }

    const claudeSnapshot: ProviderUsageSnapshot = {
      provider: "claude",
      displayName: "Claude",
      sessionPercent: 35,
      sessionResetAt: "2026-01-25T05:00:00.000Z",
      weeklyPercent: 72,
      weeklyResetAt: "2026-01-31T13:20:00.000Z",
      lastUpdated: "2026-03-28T02:00:00.000Z",
    };
    const agySnapshot: ProviderUsageSnapshot = {
      provider: "agy",
      displayName: "Agy",
      sessionPercent: 20,
      sessionResetAt: "2026-01-25T05:00:00.000Z",
      weeklyPercent: 45,
      weeklyResetAt: "2026-01-31T13:20:00.000Z",
      thirdPartySessionPercent: 60,
      thirdPartySessionResetAt: "2026-01-25T05:00:00.000Z",
      thirdPartyWeeklyPercent: 80,
      thirdPartyWeeklyResetAt: "2026-01-31T13:20:00.000Z",
      lastUpdated: "2026-03-28T02:00:00.000Z",
    };

    const claude = normalizeProviderUsage(claudeSnapshot, {
      language: "en",
      timeDisplay: "utc",
      timeFormat: "24h",
      showRemainingUsageByProvider: { claude: true },
    });
    const agy = normalizeProviderUsage(agySnapshot, {
      language: "en",
      timeDisplay: "utc",
      timeFormat: "24h",
      showRemainingUsageByProvider: { agy: true },
    });

    expect(claude.session.percent).toBe(35);
    expect(claude.session.displayPercent).toBe(65);
    expect(claude.session.percentLabel).toBe("Remaining 65%");
    expect(claude.session.barMode).toBe("remaining");
    expect(agy.session.displayPercent).toBe(80);
    expect(agy.thirdPartySession?.displayPercent).toBe(40);
    expect(agy.thirdPartyWeekly?.barMode).toBe("remaining");
  });

  it("formats local Codex token and cost details", async () => {
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
      sessionPercent: 0,
      sessionResetAt: null,
      weeklyPercent: 12,
      weeklyResetAt: "2026-06-29T00:00:00.000Z",
      monthlyPercent: 4,
      monthlyResetAt: "2026-07-01T00:00:00.000Z",
      lastUpdated: "2026-06-23T02:22:38.325Z",
      localUsage: {
        source: "codex-local",
        inputTokens: 5000,
        cachedInputTokens: 1800,
        outputTokens: 300,
        reasoningOutputTokens: 50,
        totalTokens: 5300,
        estimatedCostUsd: 0.00777,
        weeklyTokens: 4200,
        dailyTokens: 1200,
        dailyCostUsd: 0.001,
        weeklyCostUsd: 0.006,
        monthlyCostUsd: 0.00777,
        dailyLimitUsd: 10,
        weeklyLimitUsd: 50,
        monthlyLimitUsd: 200,
        providerMultiplier: 2,
        sessionCount: 2,
        model: "gpt-5.4-mini",
        pricingModel: "gpt-5.4-mini",
        modelBreakdown: [
          {
            model: "gpt-5.4-mini",
            inputTokens: 5000,
            cachedInputTokens: 1800,
            outputTokens: 300,
            reasoningOutputTokens: 50,
            totalTokens: 5300,
          },
        ],
        dailyModelBreakdown: [
          {
            model: "gpt-5.4-mini",
            inputTokens: 1000,
            cachedInputTokens: 100,
            outputTokens: 80,
            reasoningOutputTokens: 20,
            totalTokens: 1200,
          },
        ],
        weeklyModelBreakdown: [
          {
            model: "gpt-5.4-mini",
            inputTokens: 3900,
            cachedInputTokens: 100,
            outputTokens: 160,
            reasoningOutputTokens: 40,
            totalTokens: 4200,
          },
        ],
        recentDailyUsage: [
          {
            date: "2026-06-22",
            totalTokens: 3000,
            costUsd: 0.004,
          },
          {
            date: "2026-06-23",
            totalTokens: 1200,
            costUsd: 0.001,
          },
        ],
      },
    };

    const normalized = normalizeProviderUsage(snapshot, {
      language: "en",
      timeDisplay: "utc",
      timeFormat: "24h",
    });

    expect(normalized.session.label).toBe("Daily");
    expect(normalized.weekly.percent).toBe(12);
    expect(normalized.weekly.displayPercent).toBe(12);
    expect(normalized.monthly?.label).toBe("Monthly");
    expect(normalized.monthly?.percent).toBe(4);
    expect(normalized.monthly?.percentLabel).toBe("4%");
    expect(normalized.localUsage).toEqual({
      sourceLabel: "Local Codex data",
      totalTokensLabel: "5.3K tokens",
      estimatedCostLabel: "Estimated cost $0.0078",
      historyUsageLabel: "History: 5.3K ($0.01)",
      weeklyUsageLabel: "This week: 4.2K ($0.01)",
      todayUsageLabel: "Today: 1.2K ($0.00)",
      multiplierLabel: "Provider multiplier x2.0",
      modelLabel: "Pricing model gpt-5.4-mini",
      modelBreakdown: [
        {
          model: "gpt-5.4-mini",
          tokensLabel: "5.3K",
          percentLabel: "100%",
          detailLabel:
            "gpt-5.4-mini: 5.3K · Input/cached/output/reasoning 5K / 1.8K / 300 / 50",
          isFallback: undefined,
        },
      ],
      modelBreakdowns: {
        history: [
          {
            model: "gpt-5.4-mini",
            tokensLabel: "5.3K",
            percentLabel: "100%",
            detailLabel:
              "gpt-5.4-mini: 5.3K · Input/cached/output/reasoning 5K / 1.8K / 300 / 50",
            isFallback: undefined,
          },
        ],
        today: [
          {
            model: "gpt-5.4-mini",
            tokensLabel: "1.2K",
            percentLabel: "100%",
            detailLabel:
              "gpt-5.4-mini: 1.2K · Input/cached/output/reasoning 1K / 100 / 80 / 20",
            isFallback: undefined,
          },
        ],
        weekly: [
          {
            model: "gpt-5.4-mini",
            tokensLabel: "4.2K",
            percentLabel: "100%",
            detailLabel:
              "gpt-5.4-mini: 4.2K · Input/cached/output/reasoning 3.9K / 100 / 160 / 40",
            isFallback: undefined,
          },
        ],
      },
      sessionCountLabel: "2 sessions",
      tokenBreakdownLabel: "Input/cached/output/reasoning 5K / 1.8K / 300 / 50",
      recentDailyUsage: [
        {
          barPercent: 100,
          costLabel: "$0.00",
          costUsd: 0.004,
          dateLabel: "06/22",
          tokensLabel: "3K",
          totalTokens: 3000,
        },
        {
          barPercent: 25,
          costLabel: "$0.00",
          costUsd: 0.001,
          dateLabel: "06/23",
          tokensLabel: "1.2K",
          totalTokens: 1200,
        },
      ],
    });
  });

  it("keeps official Codex labels when local history is attached as chart data", async () => {
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
      sessionPercent: 14,
      sessionResetAt: "2026-06-23T10:34:00.000Z",
      weeklyPercent: 50,
      weeklyResetAt: "2026-06-25T02:03:00.000Z",
      lastUpdated: "2026-06-23T02:22:38.325Z",
      localUsagePrimary: false,
      localUsage: {
        source: "codex-local",
        inputTokens: 5000,
        cachedInputTokens: 1800,
        outputTokens: 300,
        reasoningOutputTokens: 50,
        totalTokens: 5300,
        estimatedCostUsd: 0.00777,
        weeklyTokens: 4200,
        dailyTokens: 1200,
        dailyCostUsd: 0.001,
        weeklyCostUsd: 0.006,
        monthlyCostUsd: 0.00777,
        dailyLimitUsd: 10,
        weeklyLimitUsd: 50,
        monthlyLimitUsd: 200,
        providerMultiplier: 2,
        sessionCount: 2,
        model: "gpt-5.4-mini",
        pricingModel: "gpt-5.4-mini",
        modelBreakdown: [
          {
            model: "gpt-5.4-mini",
            inputTokens: 5000,
            cachedInputTokens: 1800,
            outputTokens: 300,
            reasoningOutputTokens: 50,
            totalTokens: 5300,
          },
        ],
        dailyModelBreakdown: [
          {
            model: "gpt-5.4-mini",
            inputTokens: 1000,
            cachedInputTokens: 100,
            outputTokens: 80,
            reasoningOutputTokens: 20,
            totalTokens: 1200,
          },
        ],
        weeklyModelBreakdown: [
          {
            model: "gpt-5.4-mini",
            inputTokens: 3900,
            cachedInputTokens: 100,
            outputTokens: 160,
            reasoningOutputTokens: 40,
            totalTokens: 4200,
          },
        ],
        recentDailyUsage: [
          {
            date: "2026-06-23",
            totalTokens: 1200,
            costUsd: 0.001,
          },
        ],
      },
    };

    const normalized = normalizeProviderUsage(snapshot, {
      language: "zh-CN",
      timeDisplay: "taipei",
      timeFormat: "24h",
    });

    expect(normalized.session.label).toBe("每五小时");
    expect(normalized.weekly.label).toBe("每周");
    expect(normalized.localUsage?.todayUsageLabel).toBe("今日用量：1.2千（$0.00）");
  });
});
