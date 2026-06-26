import type { ProviderUsageSnapshot } from "../shared/usage";

interface CodexTokenCountPayload {
  type?: string;
  rate_limits?: {
    primary?: {
      used_percent?: number;
      resets_at?: number;
    };
    secondary?: {
      used_percent?: number;
      resets_at?: number;
    };
  };
}

interface CodexJsonlEvent {
  timestamp?: string;
  payload?: CodexTokenCountPayload;
}

export function extractLatestCodexUsage(
  jsonl: string,
): ProviderUsageSnapshot | null {
  const tokenCountEvent = jsonl
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as CodexJsonlEvent];
      } catch {
        return [];
      }
    })
    .reverse()
    .find((event) => event.payload?.type === "token_count");

  if (!tokenCountEvent?.payload?.rate_limits?.primary) {
    return null;
  }

  const primary = tokenCountEvent.payload.rate_limits.primary;
  const secondary = tokenCountEvent.payload.rate_limits.secondary;

  if (
    typeof primary.used_percent !== "number" ||
    typeof primary.resets_at !== "number" ||
    typeof secondary?.used_percent !== "number" ||
    typeof secondary.resets_at !== "number" ||
    typeof tokenCountEvent.timestamp !== "string"
  ) {
    return null;
  }

  return {
    provider: "codex",
    displayName: "Codex",
    sessionPercent: primary.used_percent,
    sessionResetAt: primary.resets_at,
    weeklyPercent: secondary.used_percent,
    weeklyResetAt: secondary.resets_at,
    lastUpdated: tokenCountEvent.timestamp,
    health: "available",
  };
}
