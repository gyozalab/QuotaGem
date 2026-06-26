import { extractAntigravityQuota } from "./antigravity";
import summary from "./__fixtures__/agy-quota-summary.json";

describe("extractAntigravityQuota", () => {
  it("maps both groups (5h->session, weekly->weekly) and aggregates top-level per-track", () => {
    const snapshot = extractAntigravityQuota(summary, {
      lastUpdated: "2026-06-19T20:00:00Z",
    });

    expect(snapshot).not.toBeNull();
    if (!snapshot) {
      return;
    }

    expect(snapshot.provider).toBe("antigravity");
    expect(snapshot.displayName).toBe("Antigravity");
    expect(snapshot.health).toBe("available");
    expect(snapshot.lastUpdated).toBe("2026-06-19T20:00:00Z");
    expect(snapshot.groups).toHaveLength(2);

    const gemini = snapshot.groups?.find((g) => g.label === "Gemini Models");
    expect(gemini?.sessionPercent).toBeCloseTo(0.32012, 3);
    expect(gemini?.sessionResetAt).toBe("2026-06-19T15:57:12Z");
    expect(gemini?.weeklyPercent).toBeCloseTo(3.604984, 3);
    expect(gemini?.weeklyResetAt).toBe("2026-06-22T06:32:23Z");

    const thirdParty = snapshot.groups?.find(
      (g) => g.label === "Claude and GPT models",
    );
    expect(thirdParty?.sessionPercent).toBe(0);
    expect(thirdParty?.weeklyPercent).toBe(0);

    // 頂層 per-track 聚合：取最緊軌，percent 與 resetAt 同源（皆來自 Gemini）。
    expect(snapshot.sessionPercent).toBeCloseTo(0.32012, 3);
    expect(snapshot.sessionResetAt).toBe("2026-06-19T15:57:12Z");
    expect(snapshot.weeklyPercent).toBeCloseTo(3.604984, 3);
    expect(snapshot.weeklyResetAt).toBe("2026-06-22T06:32:23Z");
  });

  it("returns null when response.groups is missing or empty", () => {
    expect(extractAntigravityQuota({}, { lastUpdated: "t" })).toBeNull();
    expect(extractAntigravityQuota({ response: {} }, { lastUpdated: "t" })).toBeNull();
    expect(
      extractAntigravityQuota({ response: { groups: [] } }, { lastUpdated: "t" }),
    ).toBeNull();
    expect(extractAntigravityQuota(null, { lastUpdated: "t" })).toBeNull();
  });

  it("treats out-of-range fractions as a failed track, tolerates window variants and group order", () => {
    const snapshot = extractAntigravityQuota(
      {
        response: {
          groups: [
            {
              displayName: "Claude and GPT models",
              buckets: [
                { window: " WEEKLY ", remainingFraction: 0.5, resetTime: "w" },
                { window: "5H", remainingFraction: 1.2, resetTime: "s" },
              ],
            },
            {
              displayName: "Gemini Models",
              buckets: [
                { window: "5h", remainingFraction: 0.8, resetTime: "g5" },
                { window: "weekly", remainingFraction: -0.1, resetTime: "gw" },
              ],
            },
          ],
        },
      },
      { lastUpdated: "t" },
    );

    expect(snapshot).not.toBeNull();
    if (!snapshot) {
      return;
    }

    const thirdParty = snapshot.groups?.find(
      (g) => g.label === "Claude and GPT models",
    );
    expect(thirdParty?.sessionPercent).toBeNull();
    expect(thirdParty?.sessionResetAt).toBeNull();
    expect(thirdParty?.weeklyPercent).toBeCloseTo(50, 6);

    const gemini = snapshot.groups?.find((g) => g.label === "Gemini Models");
    expect(gemini?.sessionPercent).toBeCloseTo(20, 6);
    expect(gemini?.weeklyPercent).toBeNull();
  });

  it("returns null when no group has any valid bucket", () => {
    const snapshot = extractAntigravityQuota(
      {
        response: {
          groups: [
            {
              displayName: "Broken",
              buckets: [
                { window: "5h", remainingFraction: 5 },
                { window: "weekly", remainingFraction: 2 },
              ],
            },
          ],
        },
      },
      { lastUpdated: "t" },
    );

    expect(snapshot).toBeNull();
  });
});
