describe("extractLatestCodexUsage", () => {
  it("builds a provider snapshot from the latest token_count event", async () => {
    const codexModule = await import("./codex");
    const extractLatestCodexUsage = Reflect.get(
      codexModule,
      "extractLatestCodexUsage",
    );

    expect(typeof extractLatestCodexUsage).toBe("function");

    if (typeof extractLatestCodexUsage !== "function") {
      return;
    }

    const jsonl = [
      JSON.stringify({
        timestamp: "2026-03-27T09:02:26.166Z",
        type: "event_msg",
        payload: {
          type: "task_started",
        },
      }),
      JSON.stringify({
        timestamp: "2026-03-27T09:02:26.418Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: null,
          rate_limits: {
            limit_id: "codex",
            primary: {
              used_percent: 22,
              window_minutes: 300,
              resets_at: 1774610322,
            },
            secondary: {
              used_percent: 7,
              window_minutes: 10080,
              resets_at: 1775197122,
            },
          },
        },
      }),
    ].join("\n");

    expect(extractLatestCodexUsage(jsonl)).toEqual({
      provider: "codex",
      displayName: "Codex",
      sessionPercent: 22,
      sessionResetAt: 1774610322,
      weeklyPercent: 7,
      weeklyResetAt: 1775197122,
      lastUpdated: "2026-03-27T09:02:26.418Z",
      health: "available",
    });
  });

  it("skips malformed JSONL lines and still uses the latest valid token_count event", async () => {
    const codexModule = await import("./codex");
    const extractLatestCodexUsage = Reflect.get(
      codexModule,
      "extractLatestCodexUsage",
    );

    expect(typeof extractLatestCodexUsage).toBe("function");

    if (typeof extractLatestCodexUsage !== "function") {
      return;
    }

    const jsonl = [
      JSON.stringify({
        timestamp: "2026-03-27T09:02:26.166Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          rate_limits: {
            primary: {
              used_percent: 22,
              resets_at: 1774610322,
            },
            secondary: {
              used_percent: 7,
              resets_at: 1775197122,
            },
          },
        },
      }),
      "{ bad json",
      JSON.stringify({
        timestamp: "2026-03-27T09:12:26.166Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          rate_limits: {
            primary: {
              used_percent: 31,
              resets_at: 1774613922,
            },
            secondary: {
              used_percent: 9,
              resets_at: 1775200722,
            },
          },
        },
      }),
    ].join("\n");

    expect(extractLatestCodexUsage(jsonl)).toEqual({
      provider: "codex",
      displayName: "Codex",
      sessionPercent: 31,
      sessionResetAt: 1774613922,
      weeklyPercent: 9,
      weeklyResetAt: 1775200722,
      lastUpdated: "2026-03-27T09:12:26.166Z",
      health: "available",
    });
  });

  it("builds a local token and cost snapshot from the latest token_count per session", async () => {
    const codexModule = await import("./codex");
    const extractLocalCodexUsage = Reflect.get(
      codexModule,
      "extractLocalCodexUsage",
    );

    expect(typeof extractLocalCodexUsage).toBe("function");

    if (typeof extractLocalCodexUsage !== "function") {
      return;
    }

    const firstSession = [
      JSON.stringify({
        timestamp: "2026-06-23T01:00:00.000Z",
        type: "turn_context",
        payload: {
          model: "gpt-5.4-mini",
        },
      }),
      JSON.stringify({
        timestamp: "2026-06-23T01:01:00.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              input_tokens: 1000,
              cached_input_tokens: 400,
              output_tokens: 50,
              reasoning_output_tokens: 10,
              total_tokens: 1050,
            },
          },
        },
      }),
      JSON.stringify({
        timestamp: "2026-06-23T01:02:00.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              input_tokens: 2000,
              cached_input_tokens: 800,
              output_tokens: 100,
              reasoning_output_tokens: 20,
              total_tokens: 2100,
            },
          },
        },
      }),
    ].join("\n");
    const secondSession = JSON.stringify({
      timestamp: "2026-06-23T02:00:00.000Z",
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          total_token_usage: {
            input_tokens: 3000,
            cached_input_tokens: 1000,
            output_tokens: 200,
            reasoning_output_tokens: 30,
            total_tokens: 3200,
          },
        },
      },
    });

    const snapshot = extractLocalCodexUsage(
      [
        { file: "first.jsonl", content: firstSession },
        { file: "second.jsonl", content: secondSession },
      ],
      {
        dailyLimitUsd: 1,
        monthlyLimitUsd: 4,
        providerMultiplier: 2,
        weeklyLimitUsd: 2,
        now: new Date("2026-06-23T12:00:00+08:00"),
      },
    );

    expect(snapshot).toMatchObject({
      provider: "codex",
      displayName: "Codex",
      lastUpdated: "2026-06-23T02:00:00.000Z",
      health: "available",
      localUsage: {
        inputTokens: 5000,
        cachedInputTokens: 1800,
        outputTokens: 300,
        reasoningOutputTokens: 50,
        totalTokens: 5300,
        weeklyTokens: 5300,
        dailyTokens: 5300,
        providerMultiplier: 2,
        sessionCount: 2,
        dailyLimitUsd: 1,
        weeklyLimitUsd: 2,
        monthlyLimitUsd: 4,
        pricingModel: "mixed",
      },
    });
    expect(snapshot?.sessionPercent).toBeCloseTo(3.582);
    expect(snapshot?.weeklyPercent).toBeCloseTo(1.791);
    expect(snapshot?.monthlyPercent).toBeCloseTo(0.8955);
    expect(snapshot?.localUsage?.estimatedCostUsd).toBeCloseTo(0.03582);
    expect(snapshot?.localUsage?.dailyCostUsd).toBeCloseTo(0.03582);
    expect(snapshot?.localUsage?.weeklyCostUsd).toBeCloseTo(0.03582);
    expect(snapshot?.localUsage?.monthlyCostUsd).toBeCloseTo(0.03582);
    expect(snapshot?.localUsage?.recentDailyUsage).toHaveLength(7);
    expect(snapshot?.localUsage?.recentDailyUsage.at(-1)).toEqual({
      date: "2026-06-23",
      totalTokens: 5300,
      costUsd: expect.any(Number),
    });
    expect(snapshot?.localUsage?.recentDailyUsage.at(-1)?.costUsd).toBeCloseTo(0.03582);
  });
});
