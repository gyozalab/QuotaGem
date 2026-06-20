import { normalizeProviderUsage } from "./usage";
import { t } from "./i18n";
import type { ProviderUsageSnapshot } from "./usage";

const options = {
  language: "en" as const,
  timeDisplay: "utc" as const,
  timeFormat: "24h" as const,
};

describe("normalizeProviderUsage with provider groups", () => {
  it("normalizes per-group tracks and renders null tracks as unavailable", () => {
    const snapshot: ProviderUsageSnapshot = {
      provider: "antigravity",
      displayName: "Antigravity",
      sessionPercent: 0.32,
      sessionResetAt: "2026-06-19T15:57:12Z",
      weeklyPercent: 3.6,
      weeklyResetAt: "2026-06-22T06:32:23Z",
      lastUpdated: "2026-06-19T20:00:00Z",
      health: "available",
      groups: [
        {
          label: "Gemini Models",
          sessionPercent: 0.32,
          sessionResetAt: "2026-06-19T15:57:12Z",
          weeklyPercent: 3.6,
          weeklyResetAt: "2026-06-22T06:32:23Z",
        },
        {
          label: "Claude and GPT models",
          sessionPercent: 0,
          sessionResetAt: "2026-06-19T16:42:55Z",
          weeklyPercent: null,
          weeklyResetAt: null,
        },
      ],
    };

    const normalized = normalizeProviderUsage(snapshot, options);

    expect(normalized.groups).toHaveLength(2);
    expect(normalized.groups?.[0].label).toBe("Gemini Models");
    expect(normalized.groups?.[0].session.percent).toBe(0.32);
    expect(normalized.groups?.[0].session.resetLabel).toBe("2026-06-19 15:57 UTC");
    // null 軌 → percent 0、resetLabel 顯示 unavailable
    expect(normalized.groups?.[1].weekly.percent).toBe(0);
    expect(normalized.groups?.[1].weekly.resetLabel).toBe(t("en", "unavailable"));
    // 頂層仍正常
    expect(normalized.session.percent).toBe(0.32);
  });

  it("omits groups for providers without groups (claude/codex unchanged)", () => {
    const snapshot: ProviderUsageSnapshot = {
      provider: "claude",
      displayName: "Claude",
      sessionPercent: 10,
      sessionResetAt: null,
      weeklyPercent: 20,
      weeklyResetAt: null,
      lastUpdated: "2026-06-19T20:00:00Z",
      health: "available",
    };

    const normalized = normalizeProviderUsage(snapshot, options);
    expect("groups" in normalized).toBe(false);
  });
});
