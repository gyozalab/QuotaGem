import { t, type WidgetLanguage } from "./i18n";
import type { DateFormatPreference } from "./dashboard";

export type ProviderId = "claude" | "codex" | "antigravity";
export type ProviderHealth = "available" | "stale" | "unavailable";

export interface ProviderUsageGroup {
  label: string;
  sessionPercent: number | null;
  sessionResetAt: number | string | Date | null;
  weeklyPercent: number | null;
  weeklyResetAt: number | string | Date | null;
}

export interface ProviderUsageSnapshot {
  provider: ProviderId;
  displayName: string;
  sessionPercent: number;
  sessionResetAt: number | string | Date | null;
  weeklyPercent: number;
  weeklyResetAt: number | string | Date | null;
  lastUpdated: string;
  health?: ProviderHealth;
  groups?: ProviderUsageGroup[];
}

export interface NormalizedProviderUsage {
  provider: ProviderId;
  displayName: string;
  health: ProviderHealth;
  session: {
    label: string;
    percent: number;
    resetLabel: string;
    level: "normal" | "warning" | "danger";
  };
  weekly: {
    label: string;
    percent: number;
    resetLabel: string;
    level: "normal" | "warning" | "danger";
  };
  groups?: NormalizedProviderUsageGroup[];
  lastUpdated: string;
}

export interface NormalizedUsageTrack {
  label: string;
  percent: number;
  resetLabel: string;
  level: "normal" | "warning" | "danger";
}

export interface NormalizedProviderUsageGroup {
  label: string;
  session: NormalizedUsageTrack;
  weekly: NormalizedUsageTrack;
}

export interface UsageThresholds {
  warningThreshold: number;
  dangerThreshold: number;
}

export function normalizeProviderUsage(
  snapshot: ProviderUsageSnapshot,
  options: {
    language: WidgetLanguage;
    timeDisplay: "utc" | "local";
    timeFormat: "24h" | "12h";
    dateFormat?: DateFormatPreference;
    warningThreshold?: number;
    dangerThreshold?: number;
    locale?: string;
  },
): NormalizedProviderUsage {
  const thresholds = normalizeUsageThresholds(options);

  const buildTrack = (
    labelKey: "session" | "weekly",
    percent: number | null,
    resetAt: number | string | Date | null,
  ): NormalizedUsageTrack => {
    const safePercent = percent ?? 0;
    return {
      label: t(options.language, labelKey),
      percent: safePercent,
      resetLabel:
        percent === null
          ? t(options.language, "unavailable")
          : formatResetDisplay(
              resetAt,
              options.language,
              options.timeDisplay,
              options.timeFormat,
              options.dateFormat,
              options.locale,
            ),
      level: getUsageLevel(safePercent, thresholds),
    };
  };

  const normalized: NormalizedProviderUsage = {
    provider: snapshot.provider,
    displayName: snapshot.displayName,
    health: snapshot.health ?? "available",
    session: buildTrack("session", snapshot.sessionPercent, snapshot.sessionResetAt),
    weekly: buildTrack("weekly", snapshot.weeklyPercent, snapshot.weeklyResetAt),
    lastUpdated: snapshot.lastUpdated,
  };

  if (snapshot.groups) {
    normalized.groups = snapshot.groups.map((group) => ({
      label: group.label,
      session: buildTrack("session", group.sessionPercent, group.sessionResetAt),
      weekly: buildTrack("weekly", group.weeklyPercent, group.weeklyResetAt),
    }));
  }

  return normalized;
}

export function normalizeUsageThresholds({
  warningThreshold = 75,
  dangerThreshold = 90,
}: Partial<UsageThresholds>): UsageThresholds {
  const safeWarningThreshold = Math.min(
    99,
    Math.max(1, Math.round(warningThreshold)),
  );
  const safeDangerThreshold = Math.min(
    100,
    Math.max(safeWarningThreshold + 1, Math.round(dangerThreshold)),
  );

  return {
    warningThreshold: safeWarningThreshold,
    dangerThreshold: safeDangerThreshold,
  };
}

function getUsageLevel(
  percent: number,
  thresholds: UsageThresholds,
): "normal" | "warning" | "danger" {
  if (percent >= thresholds.dangerThreshold) {
    return "danger";
  }

  if (percent >= thresholds.warningThreshold) {
    return "warning";
  }

  return "normal";
}

function formatResetDisplay(
  value: number | string | Date | null,
  language: WidgetLanguage,
  timeDisplay: "utc" | "local",
  timeFormat: "24h" | "12h",
  dateFormat: DateFormatPreference = "iso",
  locale = "en-US",
): string {
  if (value === null || value === "") {
    return t(language, "unavailable");
  }

  const date =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value * 1000)
        : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return t(language, "unavailable");
  }

  const parts = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: timeFormat === "12h",
    timeZone: timeDisplay === "utc" ? "UTC" : undefined,
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const suffix =
    timeDisplay === "utc" ? t(language, "utcSuffix") : t(language, "localSuffix");
  const dayPeriod = pick("dayPeriod");

  return `${formatDateParts({
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    dateFormat,
  })} ${pick("hour")}:${pick("minute")}${dayPeriod ? ` ${dayPeriod.toUpperCase()}` : ""} ${suffix}`;
}

export function formatDateParts({
  year,
  month,
  day,
  dateFormat,
}: {
  year: string;
  month: string;
  day: string;
  dateFormat: DateFormatPreference;
}): string {
  if (dateFormat === "mdy") {
    return `${month}/${day}/${year}`;
  }

  if (dateFormat === "dmy") {
    return `${day}/${month}/${year}`;
  }

  return `${year}-${month}-${day}`;
}
