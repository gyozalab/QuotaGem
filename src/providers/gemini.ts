import type { ProviderUsageSnapshot } from "../shared/usage";

interface GeminiSessionFile {
  startTime?: string;
  messages?: Array<{
    type?: string;
    tokens?: { total?: number };
  }>;
}

export interface GeminiLocalUsage {
  sessionCount: number;
  totalTokens: number;
}

export function extractGeminiLocalUsage(
  sessions: GeminiSessionFile[],
  options: { dailyLimit: number; lastUpdated: string },
): ProviderUsageSnapshot {
  const todayStart = todayMidnightPTUtc();
  const todaySessions = sessions.filter((session) => {
    if (!session.startTime) {
      return false;
    }
    return new Date(session.startTime).getTime() >= todayStart.getTime();
  });

  const sessionCount = todaySessions.length;
  const percent = options.dailyLimit > 0
    ? Math.min((sessionCount / options.dailyLimit) * 100, 100)
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

export function todayMidnightPTUtc(): Date {
  const now = new Date();
  const ptDateStr = now.toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
  const [y, m, d] = ptDateStr.split("-").map(Number);
  const isProbablyDST = m >= 3 && m <= 10;
  const utcHour = isProbablyDST ? 7 : 8;
  return new Date(Date.UTC(y, m - 1, d, utcHour, 0, 0));
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
