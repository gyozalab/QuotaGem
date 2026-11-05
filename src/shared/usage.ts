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
          : formatResetCountdown(resetAt, options.language),
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

/** 把 number(epoch 秒) / ISO 字串 / Date / null 統一解析成 Date；壞值回 null。 */
export function toResetDate(value: number | string | Date | null): Date | null {
  if (value === null || value === "") {
    return null;
  }
  const date =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value * 1000)
        : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 把重置時間顯示成相對倒數（例如「3 小時後」/「in 3 hours」）。
 * 用 Intl.RelativeTimeFormat 產生在地化字串；倒數是時間長度，與時區無關。
 */
export function formatResetCountdown(
  value: number | string | Date | null,
  language: WidgetLanguage,
  now: number = Date.now(),
): string {
  const date = toResetDate(value);
  if (date === null) {
    return t(language, "unavailable");
  }

  const diffMs = date.getTime() - now;
  if (diffMs <= 60_000) {
    // 已重置或不到一分鐘 → 即將重置
    return t(language, "resetsSoon");
  }

  const rtf = new Intl.RelativeTimeFormat(language, { numeric: "always" });
  if (diffMs >= 86_400_000) {
    // >= 1 天（週額度重置常在數天後）
    return rtf.format(Math.round(diffMs / 86_400_000), "day");
  }
  if (diffMs >= 3_600_000) {
    return rtf.format(Math.round(diffMs / 3_600_000), "hour");
  }
  return rtf.format(Math.max(1, Math.round(diffMs / 60_000)), "minute");
}

// 保留：絕對時間格式。面板現改用倒數，此函式留作未來「絕對時間」選項備用。
export function formatResetDisplay(
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
