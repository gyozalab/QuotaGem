describe("extractGeminiUsage", () => {
  it("calculates daily usage percentage from monitoring response", async () => {
    const geminiModule = await import("./gemini");
    const extractGeminiUsage = Reflect.get(geminiModule, "extractGeminiUsage");

    expect(typeof extractGeminiUsage).toBe("function");

    if (typeof extractGeminiUsage !== "function") {
      return;
    }

    const response = {
      timeSeries: [
        {
          metric: { type: "serviceruntime.googleapis.com/api/request_count" },
          points: [
            {
              interval: {
                startTime: "2026-04-06T07:00:00Z",
                endTime: "2026-04-06T08:00:00Z",
              },
              value: { int64Value: "450" },
            },
            {
              interval: {
                startTime: "2026-04-06T08:00:00Z",
                endTime: "2026-04-06T09:00:00Z",
              },
              value: { int64Value: "300" },
            },
          ],
        },
      ],
    };

    const snapshot = extractGeminiUsage(response, {
      dailyLimit: 1500,
      lastUpdated: "2026-04-06T09:00:00.000Z",
    });

    expect(snapshot).toEqual({
      provider: "gemini",
      displayName: "Gemini",
      sessionPercent: 50,
      sessionResetAt: expect.any(String),
      weeklyPercent: 0,
      weeklyResetAt: null,
      lastUpdated: "2026-04-06T09:00:00.000Z",
      health: "available",
    });
  });

  it("returns 0% when monitoring response has no time series", async () => {
    const geminiModule = await import("./gemini");
    const extractGeminiUsage = Reflect.get(geminiModule, "extractGeminiUsage");

    expect(typeof extractGeminiUsage).toBe("function");

    if (typeof extractGeminiUsage !== "function") {
      return;
    }

    const snapshot = extractGeminiUsage(
      { timeSeries: [] },
      {
        dailyLimit: 1500,
        lastUpdated: "2026-04-06T09:00:00.000Z",
      },
    );

    expect(snapshot).toEqual({
      provider: "gemini",
      displayName: "Gemini",
      sessionPercent: 0,
      sessionResetAt: expect.any(String),
      weeklyPercent: 0,
      weeklyResetAt: null,
      lastUpdated: "2026-04-06T09:00:00.000Z",
      health: "available",
    });
  });

  it("caps usage at 100% when requests exceed daily limit", async () => {
    const geminiModule = await import("./gemini");
    const extractGeminiUsage = Reflect.get(geminiModule, "extractGeminiUsage");

    expect(typeof extractGeminiUsage).toBe("function");

    if (typeof extractGeminiUsage !== "function") {
      return;
    }

    const response = {
      timeSeries: [
        {
          points: [
            { value: { int64Value: "2000" } },
          ],
        },
      ],
    };

    const snapshot = extractGeminiUsage(response, {
      dailyLimit: 1500,
      lastUpdated: "2026-04-06T09:00:00.000Z",
    });

    expect(snapshot.sessionPercent).toBe(100);
  });

  it("handles doubleValue format in monitoring points", async () => {
    const geminiModule = await import("./gemini");
    const extractGeminiUsage = Reflect.get(geminiModule, "extractGeminiUsage");

    expect(typeof extractGeminiUsage).toBe("function");

    if (typeof extractGeminiUsage !== "function") {
      return;
    }

    const response = {
      timeSeries: [
        {
          points: [
            { value: { doubleValue: 375.0 } },
          ],
        },
      ],
    };

    const snapshot = extractGeminiUsage(response, {
      dailyLimit: 1500,
      lastUpdated: "2026-04-06T09:00:00.000Z",
    });

    expect(snapshot.sessionPercent).toBe(25);
  });
});

describe("buildMonitoringFilter", () => {
  it("returns a filter targeting the generativelanguage service", async () => {
    const geminiModule = await import("./gemini");
    const buildMonitoringFilter = Reflect.get(
      geminiModule,
      "buildMonitoringFilter",
    );

    expect(typeof buildMonitoringFilter).toBe("function");

    if (typeof buildMonitoringFilter !== "function") {
      return;
    }

    const filter = buildMonitoringFilter();
    expect(filter).toContain("serviceruntime.googleapis.com/api/request_count");
    expect(filter).toContain("generativelanguage.googleapis.com");
  });
});

describe("nextMidnightPT", () => {
  it("returns a valid ISO date string", async () => {
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
