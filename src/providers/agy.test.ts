import { describe, it, expect } from "vitest";
import { extractLatestAgyUsage } from "./agy";

describe("extractLatestAgyUsage", () => {
  it("parses both Gemini and Third-Party (Claude/GPT) models usage from RetrieveUserQuotaSummary format", () => {
    const jsonl = `
{"timestamp": "2026-06-19T20:18:18.650939+08:00", "provider": "gemini", "usage": {"gemini_5h": {"remaining_fraction": 0.6774, "reset_time": "2026-06-19T12:28:55Z"}, "gemini_weekly": {"remaining_fraction": 0.8478, "reset_time": "2026-06-20T07:24:43Z"}, "third_party_5h": {"remaining_fraction": 1.0, "reset_time": "2026-06-19T17:17:47Z"}, "third_party_weekly": {"remaining_fraction": 0.4609, "reset_time": "2026-06-22T15:08:28Z"}}}
    `.trim();

    const result = extractLatestAgyUsage(jsonl);
    expect(result).toEqual({
      provider: "agy",
      displayName: "Agy",
      sessionPercent: 32.3,
      sessionResetAt: "2026-06-19T12:28:55Z",
      weeklyPercent: 15.2,
      weeklyResetAt: "2026-06-20T07:24:43Z",
      thirdPartySessionPercent: 0,
      thirdPartySessionResetAt: "2026-06-19T17:17:47Z",
      thirdPartyWeeklyPercent: 53.9,
      thirdPartyWeeklyResetAt: "2026-06-22T15:08:28Z",
      lastUpdated: "2026-06-19T12:18:18.650Z",
      health: "available",
    });
  });

  it("parses both 5-hour and weekly usage in the old RetrieveUserQuotaSummary format", () => {
    const jsonl = `
{"timestamp": "2026-06-19T20:10:07.896987+08:00", "provider": "gemini", "usage": {"five_hour": {"remaining_fraction": 0.7157139, "reset_time": "2026-06-19T12:28:55Z"}, "weekly": {"remaining_fraction": 0.8541475, "reset_time": "2026-06-20T07:24:43Z"}}}
    `.trim();

    const result = extractLatestAgyUsage(jsonl);
    expect(result).toEqual({
      provider: "agy",
      displayName: "Agy",
      sessionPercent: 28.4,
      sessionResetAt: "2026-06-19T12:28:55Z",
      weeklyPercent: 14.6,
      weeklyResetAt: "2026-06-20T07:24:43Z",
      thirdPartySessionPercent: undefined,
      thirdPartySessionResetAt: null,
      thirdPartyWeeklyPercent: undefined,
      thirdPartyWeeklyResetAt: null,
      lastUpdated: "2026-06-19T12:10:07.896Z",
      health: "available",
    });
  });

  it("parses only 5-hour usage when weekly is missing", () => {
    const jsonl = `
{"timestamp": "2026-06-19T18:21:56.667253+08:00", "provider": "gemini", "usage": {"five_hour": {"remaining_fraction": 0.7878602, "reset_time": "2026-06-19T12:28:55Z"}}}
    `.trim();

    const result = extractLatestAgyUsage(jsonl);
    expect(result).toEqual({
      provider: "agy",
      displayName: "Agy",
      sessionPercent: 21.2,
      sessionResetAt: "2026-06-19T12:28:55Z",
      weeklyPercent: 0,
      weeklyResetAt: null,
      thirdPartySessionPercent: undefined,
      thirdPartySessionResetAt: null,
      thirdPartyWeeklyPercent: undefined,
      thirdPartyWeeklyResetAt: null,
      lastUpdated: "2026-06-19T10:21:56.667Z",
      health: "available",
    });
  });

  it("parses legacy model_requests format correctly", () => {
    const jsonl = `
{"timestamp": "2026-06-19T16:02:13.000Z", "provider": "gemini", "usage": {"model_requests": {"used": 20, "limit": 200}}}
    `.trim();

    const result = extractLatestAgyUsage(jsonl);
    expect(result).toEqual({
      provider: "agy",
      displayName: "Agy",
      sessionPercent: 10,
      sessionResetAt: null,
      weeklyPercent: 0,
      weeklyResetAt: null,
      thirdPartySessionPercent: undefined,
      thirdPartySessionResetAt: null,
      thirdPartyWeeklyPercent: undefined,
      thirdPartyWeeklyResetAt: null,
      lastUpdated: "2026-06-19T16:02:13.000Z",
      health: "available",
    });
  });

  it("returns null for empty jsonl or invalid json", () => {
    expect(extractLatestAgyUsage("")).toBeNull();
    expect(extractLatestAgyUsage("invalid-json")).toBeNull();
  });
});
