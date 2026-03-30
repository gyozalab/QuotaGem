describe("extractClaudeUsage", () => {
  it("builds a provider snapshot from the Claude usage payload", async () => {
    const claudeModule = await import("./claude");
    const extractClaudeUsage = Reflect.get(claudeModule, "extractClaudeUsage");

    expect(typeof extractClaudeUsage).toBe("function");

    if (typeof extractClaudeUsage !== "function") {
      return;
    }

    const payload = {
      five_hour: {
        utilization: 35,
        resets_at: "2026-01-25T05:00:00.000Z",
      },
      seven_day: {
        utilization: 22,
        resets_at: "2026-01-31T01:00:00.000Z",
      },
    };

    expect(
      extractClaudeUsage(payload, {
        lastUpdated: "2026-03-28T03:00:00.000Z",
      }),
    ).toEqual({
      provider: "claude",
      displayName: "Claude",
      sessionPercent: 35,
      sessionResetAt: "2026-01-25T05:00:00.000Z",
      weeklyPercent: 22,
      weeklyResetAt: "2026-01-31T01:00:00.000Z",
      lastUpdated: "2026-03-28T03:00:00.000Z",
      health: "available",
    });
  });

  it("accepts numeric reset timestamps and stringified utilization values", async () => {
    const claudeModule = await import("./claude");
    const extractClaudeUsage = Reflect.get(claudeModule, "extractClaudeUsage");

    expect(typeof extractClaudeUsage).toBe("function");

    if (typeof extractClaudeUsage !== "function") {
      return;
    }

    const payload = {
      five_hour: {
        utilization: "35",
        resets_at: 1767229200,
      },
      seven_day: {
        utilization: "22.5",
        resets_at: 1767229800,
      },
    };

    expect(
      extractClaudeUsage(payload, {
        lastUpdated: "2026-03-28T03:00:00.000Z",
      }),
    ).toEqual({
      provider: "claude",
      displayName: "Claude",
      sessionPercent: 35,
      sessionResetAt: 1767229200,
      weeklyPercent: 22.5,
      weeklyResetAt: 1767229800,
      lastUpdated: "2026-03-28T03:00:00.000Z",
      health: "available",
    });
  });

  it("keeps Claude visible when a session reset time is null", async () => {
    const claudeModule = await import("./claude");
    const extractClaudeUsage = Reflect.get(claudeModule, "extractClaudeUsage");

    expect(typeof extractClaudeUsage).toBe("function");

    if (typeof extractClaudeUsage !== "function") {
      return;
    }

    const payload = {
      five_hour: {
        utilization: 0,
        resets_at: null,
      },
      seven_day: {
        utilization: 100,
        resets_at: "2026-03-29T05:00:00.046721+00:00",
      },
    };

    expect(
      extractClaudeUsage(payload, {
        lastUpdated: "2026-03-28T03:00:00.000Z",
      }),
    ).toEqual({
      provider: "claude",
      displayName: "Claude",
      sessionPercent: 0,
      sessionResetAt: null,
      weeklyPercent: 100,
      weeklyResetAt: "2026-03-29T05:00:00.046721+00:00",
      lastUpdated: "2026-03-28T03:00:00.000Z",
      health: "available",
    });
  });
});

describe("extractClaudeOrganizationId", () => {
  it("picks the first organization id from the organizations payload", async () => {
    const claudeModule = await import("./claude");
    const extractClaudeOrganizationId = Reflect.get(
      claudeModule,
      "extractClaudeOrganizationId",
    );

    expect(typeof extractClaudeOrganizationId).toBe("function");

    if (typeof extractClaudeOrganizationId !== "function") {
      return;
    }

    expect(
      extractClaudeOrganizationId([
        { uuid: "org_123" },
        { uuid: "org_456" },
      ]),
    ).toBe("org_123");
  });
});
