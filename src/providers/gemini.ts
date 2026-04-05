import type { ProviderUsageSnapshot } from "../shared/usage";

interface GeminiMonitoringPoint {
  interval?: { startTime?: string; endTime?: string };
  value?: { int64Value?: string; doubleValue?: number };
}

interface GeminiMonitoringTimeSeries {
  metric?: { type?: string; labels?: Record<string, string> };
  points?: GeminiMonitoringPoint[];
}

export interface GeminiMonitoringResponse {
  timeSeries?: GeminiMonitoringTimeSeries[];
}

export function extractGeminiUsage(
  response: GeminiMonitoringResponse,
  options: { dailyLimit: number; lastUpdated: string },
): ProviderUsageSnapshot {
  const totalRequests = countTotalRequests(response);
  const percent = options.dailyLimit > 0
    ? Math.min((totalRequests / options.dailyLimit) * 100, 100)
    : 0;

  return {
    provider: "gemini",
    displayName: "Gemini",
    sessionPercent: percent,
    sessionResetAt: nextMidnightPT(),
    weeklyPercent: 0,
    weeklyResetAt: null,
    lastUpdated: options.lastUpdated,
    health: "available",
  };
}

function countTotalRequests(response: GeminiMonitoringResponse): number {
  if (!response.timeSeries || response.timeSeries.length === 0) {
    return 0;
  }

  let total = 0;

  for (const series of response.timeSeries) {
    for (const point of series.points ?? []) {
      if (point.value?.int64Value) {
        total += parseInt(point.value.int64Value, 10) || 0;
      } else if (typeof point.value?.doubleValue === "number") {
        total += Math.round(point.value.doubleValue);
      }
    }
  }

  return total;
}

export function nextMidnightPT(): string {
  const now = new Date();
  const ptDateStr = now.toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
  const [y, m, d] = ptDateStr.split("-").map(Number);
  const isProbablyDST = m >= 3 && m <= 10;
  const utcHour = isProbablyDST ? 7 : 8;
  return new Date(Date.UTC(y, m - 1, d + 1, utcHour, 0, 0)).toISOString();
}

export function buildMonitoringFilter(): string {
  return [
    'metric.type = "serviceruntime.googleapis.com/api/request_count"',
    'resource.labels.service = "generativelanguage.googleapis.com"',
  ].join(" AND ");
}

export function buildMonitoringInterval(): { startTime: string; endTime: string } {
  const now = new Date();
  const ptDateStr = now.toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
  const [y, m, d] = ptDateStr.split("-").map(Number);
  const isProbablyDST = m >= 3 && m <= 10;
  const utcHour = isProbablyDST ? 7 : 8;
  const todayMidnightUTC = new Date(Date.UTC(y, m - 1, d, utcHour, 0, 0));

  return {
    startTime: todayMidnightUTC.toISOString(),
    endTime: now.toISOString(),
  };
}
