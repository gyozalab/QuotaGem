import type { ProviderUsageGroup, ProviderUsageSnapshot } from "../shared/usage";

interface AntigravityQuotaBucket {
  window?: string;
  remainingFraction?: number;
  resetTime?: string | null;
}

interface AntigravityQuotaGroup {
  displayName?: string;
  buckets?: AntigravityQuotaBucket[];
}

interface AntigravityQuotaSummary {
  response?: {
    groups?: AntigravityQuotaGroup[];
  };
}

const FIVE_HOUR_WINDOW = "5h";
const WEEKLY_WINDOW = "weekly";

function normalizeWindow(window: string | undefined): string | null {
  if (typeof window !== "string") {
    return null;
  }

  return window.trim().toLowerCase();
}

// remainingFraction 是「剩餘比例」。換算成已用%並 clamp：越界（私有協定回 >1 或 <0）視為解析失敗。
function usedPercentFromFraction(fraction: number | undefined): number | null {
  if (typeof fraction !== "number" || !Number.isFinite(fraction)) {
    return null;
  }

  if (fraction < 0 || fraction > 1) {
    return null;
  }

  return (1 - fraction) * 100;
}

function findBucket(
  buckets: AntigravityQuotaBucket[] | undefined,
  target: string,
): AntigravityQuotaBucket | undefined {
  if (!Array.isArray(buckets)) {
    return undefined;
  }

  return buckets.find((bucket) => normalizeWindow(bucket?.window) === target);
}

// 頂層 per-track 聚合：取最緊（已用%最高）那一軌，percent 與 resetAt 取自同一 bucket。
function pickTightest(
  groups: ProviderUsageGroup[],
  track: "session" | "weekly",
): { percent: number; resetAt: number | string | Date | null } | null {
  let best: { percent: number; resetAt: number | string | Date | null } | null =
    null;

  for (const group of groups) {
    const percent =
      track === "session" ? group.sessionPercent : group.weeklyPercent;
    const resetAt =
      track === "session" ? group.sessionResetAt : group.weeklyResetAt;

    if (percent === null) {
      continue;
    }

    if (best === null || percent > best.percent) {
      best = { percent, resetAt };
    }
  }

  return best;
}

// 解析 RetrieveUserQuotaSummary 回應 → ProviderUsageSnapshot（含逐群組 groups）。
// 純函式、無 I/O；取得/探測在 main/antigravity-service。回 null 代表無可用額度（上層降級為 unavailable）。
export function extractAntigravityQuota(
  summary: unknown,
  options: { lastUpdated: string },
): ProviderUsageSnapshot | null {
  const response = (summary as AntigravityQuotaSummary | null | undefined)
    ?.response;
  const groups = response?.groups;
  if (!Array.isArray(groups) || groups.length === 0) {
    return null;
  }

  const parsedGroups: ProviderUsageGroup[] = [];
  for (const group of groups as AntigravityQuotaGroup[]) {
    const label =
      typeof group?.displayName === "string" ? group.displayName : null;
    if (!label) {
      continue;
    }

    const fiveHour = findBucket(group.buckets, FIVE_HOUR_WINDOW);
    const weekly = findBucket(group.buckets, WEEKLY_WINDOW);
    const sessionPercent = usedPercentFromFraction(fiveHour?.remainingFraction);
    const weeklyPercent = usedPercentFromFraction(weekly?.remainingFraction);

    // 整組無任何有效軌 → 跳過該群組（缺單軌只降該軌）。
    if (sessionPercent === null && weeklyPercent === null) {
      continue;
    }

    parsedGroups.push({
      label,
      sessionPercent,
      sessionResetAt: sessionPercent === null ? null : (fiveHour?.resetTime ?? null),
      weeklyPercent,
      weeklyResetAt: weeklyPercent === null ? null : (weekly?.resetTime ?? null),
    });
  }

  if (parsedGroups.length === 0) {
    return null;
  }

  const topSession = pickTightest(parsedGroups, "session");
  const topWeekly = pickTightest(parsedGroups, "weekly");

  return {
    provider: "antigravity",
    displayName: "Antigravity",
    sessionPercent: topSession?.percent ?? 0,
    sessionResetAt: topSession?.resetAt ?? null,
    weeklyPercent: topWeekly?.percent ?? 0,
    weeklyResetAt: topWeekly?.resetAt ?? null,
    lastUpdated: options.lastUpdated,
    health: "available",
    groups: parsedGroups,
  };
}
