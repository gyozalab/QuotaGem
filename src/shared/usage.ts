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
  monthlyPercent?: number;
  monthlyResetAt?: number | string | Date | null;
  lastUpdated: string;
  health?: ProviderHealth;
  // Extra fields for agy 3P models
  thirdPartySessionPercent?: number;
  thirdPartySessionResetAt?: number | string | Date | null;
  thirdPartyWeeklyPercent?: number;
  thirdPartyWeeklyResetAt?: number | string | Date | null;
  localUsage?: LocalTokenUsageSnapshot;
  localUsagePrimary?: boolean;
}

export interface LocalTokenUsageSnapshot {
  source: "codex-local";
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  weeklyTokens: number;
  dailyTokens: number;
  dailyCostUsd: number;
  weeklyCostUsd: number;
  monthlyCostUsd: number;
  dailyLimitUsd: number;
  weeklyLimitUsd: number;
  monthlyLimitUsd: number;
  providerMultiplier: number;
  sessionCount: number;
  model: string;
  pricingModel: string;
  recentDailyUsage: Array<{
    date: string;
    totalTokens: number;
    costUsd: number;
  }>;
}

export interface NormalizedProviderUsage {
  provider: ProviderId;
  displayName: string;
  health: ProviderHealth;
  session: {
    label: string;
    percent: number;
    displayPercent: number;
    percentLabel: string;
    barMode: "used" | "remaining";
    resetLabel: string;
    level: "normal" | "warning" | "danger";
  };
  weekly: {
    label: string;
    percent: number;
    displayPercent: number;
    percentLabel: string;
    barMode: "used" | "remaining";
    resetLabel: string;
    level: "normal" | "warning" | "danger";
  };
  monthly?: {
    label: string;
    percent: number;
    displayPercent: number;
    percentLabel: string;
    barMode: "used" | "remaining";
    resetLabel: string;
    level: "normal" | "warning" | "danger";
  };
  // Extra fields for agy 3P models
  thirdPartySession?: {
    label: string;
    percent: number;
    displayPercent: number;
    percentLabel: string;
    barMode: "used" | "remaining";
    resetLabel: string;
    level: "normal" | "warning" | "danger";
  };
  thirdPartyWeekly?: {
    label: string;
    percent: number;
    displayPercent: number;
    percentLabel: string;
    barMode: "used" | "remaining";
    resetLabel: string;
    level: "normal" | "warning" | "danger";
  };
  localUsage?: {
    sourceLabel: string;
    totalTokensLabel: string;
    estimatedCostLabel: string;
    historyUsageLabel: string;
    weeklyUsageLabel: string;
    todayUsageLabel: string;
    multiplierLabel: string;
    modelLabel: string;
    sessionCountLabel: string;
    tokenBreakdownLabel: string;
    recentDailyUsage: Array<{
      dateLabel: string;
      tokensLabel: string;
      costLabel: string;
      costUsd: number;
      totalTokens: number;
      barPercent: number;
    }>;
  };
  lastUpdated: string;
}

export interface UsageThresholds {
  warningThreshold: number;
  dangerThreshold: number;
}

function isChineseLanguage(language: WidgetLanguage): boolean {
  return language === "zh-TW" || language === "zh-CN";
}

function getLocaleForLanguage(language: WidgetLanguage): string {
  if (language === "zh-TW") {
    return "zh-TW";
  }

  if (language === "zh-CN") {
    return "zh-CN";
  }

  return "en-US";
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
    codexShowRemainingUsage?: boolean;
  },
): NormalizedProviderUsage {
  const thresholds = normalizeUsageThresholds(options);
  const showRemainingUsage =
    snapshot.provider === "codex" && options.codexShowRemainingUsage === true;
  const lang = options.language;
  const isChinese = isChineseLanguage(lang);

  const isLocalUsagePrimary =
    Boolean(snapshot.localUsage) && snapshot.localUsagePrimary !== false;
  const sessionLabel = isLocalUsagePrimary
      ? (isChinese ? "每日" : "Daily")
      : t(lang, "session");
  const weeklyLabel = t(lang, "weekly");
  const monthly = snapshot.monthlyPercent !== undefined
    ? {
        label: isChinese ? "每月" : "Monthly",
        percent: snapshot.monthlyPercent,
        ...formatUsageDisplayMetric(
          lang,
          snapshot.monthlyPercent,
          showRemainingUsage,
        ),
        resetLabel: formatResetDisplay(
          snapshot.monthlyResetAt ?? null,
          options.language,
          options.timeDisplay,
          options.timeFormat,
          options.dateFormat,
          options.locale,
        ),
        level: getUsageLevel(snapshot.monthlyPercent, thresholds),
      }
    : undefined;

  let thirdPartySession = undefined;
  if (snapshot.thirdPartySessionPercent !== undefined) {
    thirdPartySession = {
      label: isChinese
        ? lang === "zh-CN" ? "Claude/GPT 5小时" : "Claude/GPT 5小時"
        : "Claude/GPT 5h",
      percent: snapshot.thirdPartySessionPercent,
      ...formatUsageDisplayMetric(
        lang,
        snapshot.thirdPartySessionPercent,
        false,
      ),
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
      label: isChinese
        ? lang === "zh-CN" ? "Claude/GPT 每周" : "Claude/GPT 每週"
        : "Claude/GPT Weekly",
      percent: snapshot.thirdPartyWeeklyPercent,
      ...formatUsageDisplayMetric(
        lang,
        snapshot.thirdPartyWeeklyPercent,
        false,
      ),
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
      ...formatUsageDisplayMetric(
        lang,
        snapshot.sessionPercent,
        showRemainingUsage,
      ),
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
      ...formatUsageDisplayMetric(
        lang,
        snapshot.weeklyPercent,
        showRemainingUsage,
      ),
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
    monthly,
    thirdPartySession,
    thirdPartyWeekly,
    localUsage: snapshot.localUsage
      ? formatLocalUsage(snapshot.localUsage, options.language)
      : undefined,
    lastUpdated: snapshot.lastUpdated,
  };
}

function formatUsageDisplayMetric(
  language: WidgetLanguage,
  usedPercent: number,
  showRemainingUsage: boolean,
): {
  displayPercent: number;
  percentLabel: string;
  barMode: "used" | "remaining";
} {
  const clampedUsedPercent = Math.min(Math.max(usedPercent, 0), 100);

  if (!showRemainingUsage) {
    return {
      displayPercent: clampedUsedPercent,
      percentLabel: `${Math.round(clampedUsedPercent)}%`,
      barMode: "used",
    };
  }

  const remainingPercent = Math.min(
    Math.max(100 - clampedUsedPercent, 0),
    100,
  );

  return {
    displayPercent: remainingPercent,
    percentLabel: t(language, "remainingPercent", {
      percent: Math.round(remainingPercent),
    }),
    barMode: "remaining",
  };
}

function formatLocalUsage(
  usage: LocalTokenUsageSnapshot,
  language: WidgetLanguage,
): NormalizedProviderUsage["localUsage"] {
  const compactNumber = new Intl.NumberFormat(
    getLocaleForLanguage(language),
    { maximumFractionDigits: 1, notation: "compact" },
  );
  const tokenNumber = new Intl.NumberFormat(getLocaleForLanguage(language));
  const costNumber = new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: usage.estimatedCostUsd >= 1 ? 2 : 4,
    minimumFractionDigits: usage.estimatedCostUsd >= 1 ? 2 : 4,
    style: "currency",
  });
  const summaryCostNumber = new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  });

  const isChinese = isChineseLanguage(language);
  const sourceLabel =
    isChinese
      ? language === "zh-CN" ? "本地 Codex 数据" : "本機 Codex 資料"
      : "Local Codex data";
  const estimatedCostPrefix =
    isChinese
      ? language === "zh-CN" ? "估算费用" : "估算費用"
      : "Estimated cost";
  const multiplierPrefix =
    isChinese
      ? language === "zh-CN" ? "供应商倍率" : "供應商倍率"
      : "Provider multiplier";
  const modelPrefix =
    isChinese
      ? language === "zh-CN" ? "计价模型" : "計價模型"
      : "Pricing model";
  const sessionsSuffix = isChinese ? "个 session" : "sessions";
  const breakdownPrefix =
    isChinese
      ? language === "zh-CN" ? "输入/缓存/输出/推理" : "輸入/快取/輸出/推理"
      : "Input/cached/output/reasoning";
  const maxDailyCost = Math.max(
    0,
    ...usage.recentDailyUsage.map((day) => day.costUsd),
  );

  return {
    sourceLabel,
    totalTokensLabel: `${compactNumber.format(usage.totalTokens)} tokens`,
    estimatedCostLabel: `${estimatedCostPrefix} ${costNumber.format(
      usage.estimatedCostUsd,
    )}`,
    historyUsageLabel: t(language, "historyUsageSummary", {
      tokens: formatTokenUnit(usage.totalTokens, language),
      cost: summaryCostNumber.format(usage.estimatedCostUsd),
    }),
    weeklyUsageLabel: t(language, "weeklyUsageSummary", {
      tokens: formatTokenUnit(usage.weeklyTokens, language),
      cost: summaryCostNumber.format(usage.weeklyCostUsd),
    }),
    todayUsageLabel: t(language, "todayUsageSummary", {
      tokens: formatTokenUnit(usage.dailyTokens, language),
      cost: summaryCostNumber.format(usage.dailyCostUsd),
    }),
    multiplierLabel: `${multiplierPrefix} x${usage.providerMultiplier.toFixed(1)}`,
    modelLabel: `${modelPrefix} ${usage.pricingModel}`,
    sessionCountLabel: `${tokenNumber.format(usage.sessionCount)} ${sessionsSuffix}`,
    tokenBreakdownLabel: `${breakdownPrefix} ${[
      usage.inputTokens,
      usage.cachedInputTokens,
      usage.outputTokens,
      usage.reasoningOutputTokens,
    ]
      .map((value) => compactNumber.format(value))
      .join(" / ")}`,
    recentDailyUsage: usage.recentDailyUsage.map((day) => ({
      dateLabel: formatShortDateLabel(day.date, language),
      tokensLabel: formatTokenUnit(day.totalTokens, language),
      costLabel: summaryCostNumber.format(day.costUsd),
      costUsd: day.costUsd,
      totalTokens: day.totalTokens,
      barPercent: maxDailyCost > 0
        ? Math.max(4, (day.costUsd / maxDailyCost) * 100)
        : 0,
    })),
  };
}

function formatTokenUnit(tokens: number, language: WidgetLanguage): string {
  const safeTokens = Math.max(0, Math.round(tokens));

  if (language === "zh-CN" || language === "zh-TW") {
    const units =
      language === "zh-CN"
        ? [
            { value: 100_000_000, label: "亿" },
            { value: 10_000_000, label: "千万" },
            { value: 1_000_000, label: "百万" },
            { value: 10_000, label: "万" },
            { value: 1_000, label: "千" },
          ]
        : [
            { value: 100_000_000, label: "億" },
            { value: 10_000_000, label: "千萬" },
            { value: 1_000_000, label: "百萬" },
            { value: 10_000, label: "萬" },
            { value: 1_000, label: "千" },
          ];
    const unit = units.find((candidate) => safeTokens >= candidate.value);

    if (!unit) {
      return String(safeTokens);
    }

    return `${formatUnitNumber(safeTokens / unit.value)}${unit.label}`;
  }

  const units = [
    { value: 1_000_000_000, label: "B" },
    { value: 1_000_000, label: "M" },
    { value: 1_000, label: "K" },
  ];
  const unit = units.find((candidate) => safeTokens >= candidate.value);

  if (!unit) {
    return String(safeTokens);
  }

  return `${formatUnitNumber(safeTokens / unit.value)}${unit.label}`;
}

function formatUnitNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  }).format(value);
}

function formatShortDateLabel(
  date: string,
  language: WidgetLanguage,
): string {
  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    day: "2-digit",
    month: "2-digit",
  }).format(parsed);
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
