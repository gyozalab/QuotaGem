import { t, type WidgetLanguage } from "./i18n";
import type { DateFormatPreference } from "./dashboard";

export type ProviderId = "claude" | "codex" | "agy";
export type ProviderHealth = "available" | "stale" | "unavailable";

export interface ProviderUsageSnapshot {
  provider: ProviderId;
  displayName: string;
  sessionPercent: number;
  sessionResetAt: number | string | Date | null;
  weeklyPercent: number;
  weeklyResetAt: number | string | Date | null;
  lastUpdated: string;
  health?: ProviderHealth;
  // Extra fields for agy 3P models
  thirdPartySessionPercent?: number;
  thirdPartySessionResetAt?: number | string | Date | null;
  thirdPartyWeeklyPercent?: number;
  thirdPartyWeeklyResetAt?: number | string | Date | null;
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
  // Extra fields for agy 3P models
  thirdPartySession?: {
    label: string;
    percent: number;
    resetLabel: string;
    level: "normal" | "warning" | "danger";
  };
  thirdPartyWeekly?: {
    label: string;
    percent: number;
    resetLabel: string;
    level: "normal" | "warning" | "danger";
  };
  lastUpdated: string;
}

export interface UsageThresholds {
  warningThreshold: number;
  dangerThreshold: number;
}

export function normalizeProviderUsage(
  snapshot: ProviderUsageSnapshot,
  options: {
    language: WidgetLanguage;
    timeDisplay: "utc" | "local" | "taipei";
    timeFormat: "24h" | "12h";
    dateFormat?: DateFormatPreference;
    warningThreshold?: number;
    dangerThreshold?: number;
    locale?: string;
  },
): NormalizedProviderUsage {
  const thresholds = normalizeUsageThresholds(options);
  const isAgy = snapshot.provider === "agy";
  const lang = options.language;

  const sessionLabel = isAgy
    ? (lang === "zh-TW" ? "Gemini 5小時" : "Gemini 5h")
    : t(lang, "session");
  const weeklyLabel = isAgy
    ? (lang === "zh-TW" ? "Gemini 每週" : "Gemini Weekly")
    : t(lang, "weekly");

  let thirdPartySession = undefined;
  if (snapshot.thirdPartySessionPercent !== undefined) {
    thirdPartySession = {
      label: lang === "zh-TW" ? "Claude/GPT 5小時" : "Claude/GPT 5h",
      percent: snapshot.thirdPartySessionPercent,
      resetLabel: formatResetDisplay(
        snapshot.thirdPartySessionResetAt ?? null,
        options.language,
        options.timeDisplay,
        options.timeFormat,
        options.dateFormat,
        options.locale,
      ),
      level: getUsageLevel(snapshot.thirdPartySessionPercent, thresholds),
    };
  }

  let thirdPartyWeekly = undefined;
  if (snapshot.thirdPartyWeeklyPercent !== undefined) {
    thirdPartyWeekly = {
      label: lang === "zh-TW" ? "Claude/GPT 每週" : "Claude/GPT Weekly",
      percent: snapshot.thirdPartyWeeklyPercent,
      resetLabel: formatResetDisplay(
        snapshot.thirdPartyWeeklyResetAt ?? null,
        options.language,
        options.timeDisplay,
        options.timeFormat,
        options.dateFormat,
        options.locale,
      ),
      level: getUsageLevel(snapshot.thirdPartyWeeklyPercent, thresholds),
    };
  }

  return {
    provider: snapshot.provider,
    displayName: snapshot.displayName,
    health: snapshot.health ?? "available",
    session: {
      label: sessionLabel,
      percent: snapshot.sessionPercent,
      resetLabel: formatResetDisplay(
        snapshot.sessionResetAt,
        options.language,
        options.timeDisplay,
        options.timeFormat,
        options.dateFormat,
        options.locale,
      ),
      level: getUsageLevel(snapshot.sessionPercent, thresholds),
    },
    weekly: {
      label: weeklyLabel,
      percent: snapshot.weeklyPercent,
      resetLabel: formatResetDisplay(
        snapshot.weeklyResetAt,
        options.language,
        options.timeDisplay,
        options.timeFormat,
        options.dateFormat,
        options.locale,
      ),
      level: getUsageLevel(snapshot.weeklyPercent, thresholds),
    },
    thirdPartySession,
    thirdPartyWeekly,
    lastUpdated: snapshot.lastUpdated,
  };
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
  timeDisplay: "utc" | "local" | "taipei",
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

  const timeZone =
    timeDisplay === "utc" ? "UTC" :
    timeDisplay === "taipei" ? "Asia/Taipei" :
    undefined;

  const parts = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: timeFormat === "12h",
    timeZone,
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const suffix =
    timeDisplay === "utc" ? t(language, "utcSuffix") :
    timeDisplay === "taipei" ? t(language, "taipeiSuffix") :
    t(language, "localSuffix");
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
