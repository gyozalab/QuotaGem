import type { ProviderUsageSnapshot } from "../shared/usage";

interface ClaudeUsageWindow {
  utilization?: number | string;
  resets_at?: number | string | Date | null;
}

interface ClaudeUsagePayload {
  five_hour?: ClaudeUsageWindow;
  seven_day?: ClaudeUsageWindow;
}

interface ClaudeOrganization {
  uuid?: string;
  id?: string;
}

export function extractClaudeUsage(
  payload: ClaudeUsagePayload,
  options: { lastUpdated: string },
): ProviderUsageSnapshot | null {
  const sessionWindow = payload.five_hour;
  const weeklyWindow = payload.seven_day;
  const sessionPercent = toNumber(sessionWindow?.utilization);
  const weeklyPercent = toNumber(weeklyWindow?.utilization);

  if (
    sessionPercent === null ||
    weeklyPercent === null
  ) {
    return null;
  }

  return {
    provider: "claude",
    displayName: "Claude",
    sessionPercent,
    sessionResetAt: sessionWindow?.resets_at ?? null,
    weeklyPercent,
    weeklyResetAt: weeklyWindow?.resets_at ?? null,
    lastUpdated: options.lastUpdated,
    health: "available",
  };
}

export function extractClaudeOrganizationId(
  organizations: ClaudeOrganization[],
): string | null {
  const firstOrganization = organizations[0];

  if (!firstOrganization) {
    return null;
  }

  return firstOrganization.uuid ?? firstOrganization.id ?? null;
}

function toNumber(value: number | string | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
