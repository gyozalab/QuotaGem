import type { ProviderUsageSnapshot } from "../shared/usage";

interface AgyRecord {
  timestamp: string;
  provider: string;
  usage: {
    five_hour?: { remaining_fraction: number; reset_time: string | null };
    weekly?: { remaining_fraction: number; reset_time: string | null };
    gemini_5h?: { remaining_fraction: number; reset_time: string | null };
    gemini_weekly?: { remaining_fraction: number; reset_time: string | null };
    third_party_5h?: { remaining_fraction: number; reset_time: string | null };
    third_party_weekly?: { remaining_fraction: number; reset_time: string | null };
    // legacy fields (kept for backward compat)
    model_requests?: { used: number; limit?: number; percent?: number };
  };
}

export function extractLatestAgyUsage(jsonl: string): ProviderUsageSnapshot | null {
  const records = jsonl
    .split(/\r?\n/u)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as AgyRecord];
      } catch {
        return [];
      }
    });

  const latest = records.at(-1);
  if (!latest) return null;

  let sessionPercent = 0;
  let sessionResetAt: string | null = null;
  let weeklyPercent = 0;
  let weeklyResetAt: string | null = null;
  let thirdPartySessionPercent: number | undefined = undefined;
  let thirdPartySessionResetAt: string | null = null;
  let thirdPartyWeeklyPercent: number | undefined = undefined;
  let thirdPartyWeeklyResetAt: string | null = null;

  const g5h = latest.usage?.gemini_5h ?? latest.usage?.five_hour;
  if (g5h?.remaining_fraction !== undefined) {
    sessionPercent = Math.round((1 - g5h.remaining_fraction) * 1000) / 10;
    sessionResetAt = g5h.reset_time ?? null;
  } else {
    // legacy Cloud Monitoring format
    const modelReqs = latest.usage?.model_requests;
    sessionPercent =
      modelReqs?.percent ??
      (modelReqs?.used !== undefined && modelReqs?.limit
        ? Math.round((modelReqs.used / modelReqs.limit) * 1000) / 10
        : 0);
  }

  const gw = latest.usage?.gemini_weekly ?? latest.usage?.weekly;
  if (gw?.remaining_fraction !== undefined) {
    weeklyPercent = Math.round((1 - gw.remaining_fraction) * 1000) / 10;
    weeklyResetAt = gw.reset_time ?? null;
  }

  const tp5h = latest.usage?.third_party_5h;
  if (tp5h?.remaining_fraction !== undefined) {
    thirdPartySessionPercent = Math.round((1 - tp5h.remaining_fraction) * 1000) / 10;
    thirdPartySessionResetAt = tp5h.reset_time ?? null;
  }

  const tpw = latest.usage?.third_party_weekly;
  if (tpw?.remaining_fraction !== undefined) {
    thirdPartyWeeklyPercent = Math.round((1 - tpw.remaining_fraction) * 1000) / 10;
    thirdPartyWeeklyResetAt = tpw.reset_time ?? null;
  }

  const lastUpdated = new Date(latest.timestamp).toISOString();

  return {
    provider: "agy",
    displayName: "Agy",
    sessionPercent,
    sessionResetAt,
    weeklyPercent,
    weeklyResetAt,
    thirdPartySessionPercent,
    thirdPartySessionResetAt,
    thirdPartyWeeklyPercent,
    thirdPartyWeeklyResetAt,
    lastUpdated,
    health: "available",
  };
}
