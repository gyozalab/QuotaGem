describe("extractGeminiLocalUsage", () => {
  it("calculates daily usage from session files with startTime after midnight PT", async () => {
    const geminiModule = await import("./gemini");
    const extractGeminiLocalUsage = Reflect.get(
      geminiModule,
      "extractGeminiLocalUsage",
    );

    expect(typeof extractGeminiLocalUsage).toBe("function");

    if (typeof extractGeminiLocalUsage !== "function") {
      return;
    }

    const now = new Date();
    const recentTime = new Date(now.getTime() - 60_000).toISOString();
    const oldTime = "2020-01-01T00:00:00.000Z";

    const sessions = [
      {
        startTime: recentTime,
        messages: [
          { type: "user" },
          { type: "gemini", tokens: { total: 100 } },
          { type: "gemini", tokens: { total: 200 } },
        ],
      },
      {
        startTime: recentTime,
        messages: [{ type: "user" }, { type: "gemini", tokens: { total: 50 } }],
      },
      { startTime: oldTime, messages: [{ type: "gemini", tokens: { total: 999 } }] },
    ];

    const snapshot = extractGeminiLocalUsage(sessions, {
      dailyLimit: 1500,
      lastUpdated: "2026-04-06T09:00:00.000Z",
    });

    expect(snapshot.provider).toBe("gemini");
    expect(snapshot.displayName).toBe("Gemini");
    expect(snapshot.sessionPercent).toBe(0.2);
    expect(snapshot.weeklyPercent).toBe(0);
    expect(snapshot.weeklyResetAt).toBeNull();
    expect(snapshot.health).toBe("available");
  });

  it("returns 0% when no sessions exist", async () => {
    const geminiModule = await import("./gemini");
    const extractGeminiLocalUsage = Reflect.get(
      geminiModule,
      "extractGeminiLocalUsage",
    );

    expect(typeof extractGeminiLocalUsage).toBe("function");

    if (typeof extractGeminiLocalUsage !== "function") {
      return;
    }

    const snapshot = extractGeminiLocalUsage([], {
      dailyLimit: 1500,
      lastUpdated: "2026-04-06T09:00:00.000Z",
    });

    expect(snapshot.sessionPercent).toBe(0);
    expect(snapshot.health).toBe("available");
  });

  it("caps usage at 100% when sessions exceed daily limit", async () => {
    const geminiModule = await import("./gemini");
    const extractGeminiLocalUsage = Reflect.get(
      geminiModule,
      "extractGeminiLocalUsage",
    );

    expect(typeof extractGeminiLocalUsage).toBe("function");

    if (typeof extractGeminiLocalUsage !== "function") {
      return;
    }

    const now = new Date();
    const recentTime = new Date(now.getTime() - 60_000).toISOString();
    const sessions = Array.from({ length: 5 }, () => ({
      startTime: recentTime,
      messages: Array.from({ length: 10 }, () => ({
        type: "gemini" as const,
        tokens: { total: 100 },
      })),
    }));

    const snapshot = extractGeminiLocalUsage(sessions, {
      dailyLimit: 20,
      lastUpdated: "2026-04-06T09:00:00.000Z",
    });

    expect(snapshot.sessionPercent).toBe(100);
  });

  it("excludes sessions without startTime", async () => {
    const geminiModule = await import("./gemini");
    const extractGeminiLocalUsage = Reflect.get(
      geminiModule,
      "extractGeminiLocalUsage",
    );

    expect(typeof extractGeminiLocalUsage).toBe("function");

    if (typeof extractGeminiLocalUsage !== "function") {
      return;
    }

    const now = new Date();
    const recentTime = new Date(now.getTime() - 60_000).toISOString();
    const sessions = [
      {
        startTime: recentTime,
        messages: [
          { type: "user" },
          { type: "gemini", tokens: { total: 100 } },
          { type: "gemini", tokens: { total: 200 } },
        ],
      },
      { messages: [{ type: "gemini", tokens: { total: 50 } }] },
      { startTime: undefined, messages: [{ type: "gemini", tokens: { total: 50 } }] },
    ];

    const snapshot = extractGeminiLocalUsage(sessions, {
      dailyLimit: 1000,
      lastUpdated: "2026-04-06T09:00:00.000Z",
    });

    expect(snapshot.sessionPercent).toBe(0.2);
  });
});

describe("nextMidnightPT", () => {
  it("returns a valid ISO date string in the future", async () => {
    const geminiModule = await import("./gemini");
    const nextMidnightPT = Reflect.get(geminiModule, "nextMidnightPT");

    expect(typeof nextMidnightPT).toBe("function");

    if (typeof nextMidnightPT !== "function") {
      return;
    }

    const result = nextMidnightPT();
    expect(typeof result).toBe("string");
    expect(new Date(result).getTime()).toBeGreaterThan(Date.now());
  });
});

describe("todayMidnightPTUtc", () => {
  it("returns a Date in the past", async () => {
    const geminiModule = await import("./gemini");
    const todayMidnightPTUtc = Reflect.get(geminiModule, "todayMidnightPTUtc");

    expect(typeof todayMidnightPTUtc).toBe("function");

    if (typeof todayMidnightPTUtc !== "function") {
      return;
    }

    const result = todayMidnightPTUtc();
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
