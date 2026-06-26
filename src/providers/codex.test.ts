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
});
