import type {
  LocalTokenUsageSnapshot,
  ModelTokenUsageSnapshot,
  ProviderUsageSnapshot,
} from "../shared/usage";

interface CodexTokenCountPayload {
  type?: string;
  info?: {
    total_token_usage?: CodexTokenUsage;
  };
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
  type?: string;
  timestamp?: string;
  payload?: CodexTokenCountPayload;
}

interface CodexTurnContextEvent {
  type?: string;
  payload?: {
    model?: string;
  };
}

interface CodexTokenUsage {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
  total_tokens?: number;
}

export interface CodexSessionFile {
  file: string;
  content: string;
}

const DEFAULT_CODEX_PRICING_MODEL = "gpt-5.5";

const CODEX_MODEL_PRICES_USD_PER_1M: Record<
  string,
  {
    input: number;
    cachedInput: number;
    output: number;
  }
> = {
  "gpt-5.5": {
    input: 5,
    cachedInput: 0.5,
    output: 30,
  },
  "gpt-5.4": {
    input: 2.5,
    cachedInput: 0.25,
    output: 15,
  },
  "gpt-5.4-mini": {
    input: 0.75,
    cachedInput: 0.075,
    output: 4.5,
  },
};

export function extractLatestCodexUsage(
  jsonl: string,
): ProviderUsageSnapshot | null {
  const lines = jsonl.split(/\r?\n/u);
  let tokenCountEvent: CodexJsonlEvent | undefined;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]?.trim();

    if (!line) {
      continue;
    }

    try {
      const event = JSON.parse(line) as CodexJsonlEvent;

      if (event.payload?.type === "token_count") {
        tokenCountEvent = event;
        break;
      }
    } catch {
      continue;
    }
  }

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

export function extractLocalCodexUsage(
  sessionFiles: CodexSessionFile[],
  options: {
    dailyLimitUsd?: number;
    monthlyLimitUsd?: number;
    providerMultiplier?: number;
    weeklyLimitUsd?: number;
    now?: Date;
  } = {},
): ProviderUsageSnapshot | null {
  const providerMultiplier = normalizeCodexProviderMultiplier(
    options.providerMultiplier ?? 1,
  );
  const limits = {
    daily: normalizeCodexUsdLimit(options.dailyLimitUsd ?? 10),
    weekly: normalizeCodexUsdLimit(options.weeklyLimitUsd ?? 50),
    monthly: normalizeCodexUsdLimit(options.monthlyLimitUsd ?? 200),
  };
  const periods = getLocalUsagePeriods(options.now ?? new Date());
  const sessionSummaries = sessionFiles
    .map((sessionFile) => extractLocalCodexSessionUsage(sessionFile))
    .filter((summary): summary is LocalCodexSessionUsage => summary !== null);

  if (sessionSummaries.length === 0) {
    return null;
  }

  const totals = sessionSummaries.reduce(
    (result, summary) => ({
      inputTokens: result.inputTokens + summary.usage.inputTokens,
      cachedInputTokens:
        result.cachedInputTokens + summary.usage.cachedInputTokens,
      outputTokens: result.outputTokens + summary.usage.outputTokens,
      reasoningOutputTokens:
        result.reasoningOutputTokens + summary.usage.reasoningOutputTokens,
      totalTokens: result.totalTokens + summary.usage.totalTokens,
    }),
    {
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningOutputTokens: 0,
      totalTokens: 0,
    },
  );
  const latestSession = sessionSummaries
    .slice()
    .sort((left, right) => left.lastUpdated.localeCompare(right.lastUpdated))
    .at(-1);
  const pricingModels = Array.from(
    new Set(
      sessionSummaries.map((summary) => resolvePricingModel(summary.model)),
    ),
  );
  const pricingModel =
    pricingModels.length === 1
      ? pricingModels[0]
      : "mixed";
  const increments = sessionSummaries.flatMap((summary) => summary.increments);
  const modelBreakdown = buildLocalCodexModelBreakdown(increments);
  const weeklyUsage = summarizePeriodUsage(increments, periods.week);
  const dailyUsage = summarizePeriodUsage(increments, periods.day);
  const dailyIncrements = filterLocalCodexIncrements(increments, periods.day);
  const weeklyIncrements = filterLocalCodexIncrements(increments, periods.week);
  const dailyCostUsd = estimatePeriodCostUsd(increments, periods.day) *
    providerMultiplier;
  const weeklyCostUsd = estimatePeriodCostUsd(increments, periods.week) *
    providerMultiplier;
  const monthlyCostUsd = estimatePeriodCostUsd(increments, periods.month) *
    providerMultiplier;
  const recentDailyUsage = getRecentLocalUsageDays(options.now ?? new Date())
    .map((period) => {
      const usage = summarizePeriodUsage(increments, period);

      return {
        date: formatLocalDateKey(period.start),
        totalTokens: usage.totalTokens,
        costUsd: usage.costUsd * providerMultiplier,
      };
    });
  const localUsage: LocalTokenUsageSnapshot = {
    source: "codex-local",
    ...totals,
    estimatedCostUsd:
      sessionSummaries.reduce(
        (sum, summary) =>
          sum + estimateCodexCostUsd(summary.usage, summary.model),
        0,
      ) * providerMultiplier,
    weeklyTokens: weeklyUsage.totalTokens,
    dailyTokens: dailyUsage.totalTokens,
    dailyCostUsd,
    weeklyCostUsd,
    monthlyCostUsd,
    dailyLimitUsd: limits.daily,
    weeklyLimitUsd: limits.weekly,
    monthlyLimitUsd: limits.monthly,
    providerMultiplier,
    sessionCount: sessionSummaries.length,
    model: pricingModel,
    pricingModel,
    modelBreakdown,
    dailyModelBreakdown: buildLocalCodexModelBreakdown(dailyIncrements),
    weeklyModelBreakdown: buildLocalCodexModelBreakdown(weeklyIncrements),
    recentDailyUsage,
  };

  return {
    provider: "codex",
    displayName: "Codex",
    sessionPercent: toLimitPercent(dailyCostUsd, limits.daily),
    sessionResetAt: periods.day.end,
    weeklyPercent: toLimitPercent(weeklyCostUsd, limits.weekly),
    weeklyResetAt: periods.week.end,
    monthlyPercent: toLimitPercent(monthlyCostUsd, limits.monthly),
    monthlyResetAt: periods.month.end,
    lastUpdated: latestSession?.lastUpdated ?? "",
    health: "available",
    localUsage,
    localUsagePrimary: true,
  };
}

export function normalizeCodexProviderMultiplier(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(10, Math.max(0, Math.round(value * 10) / 10));
}

interface LocalCodexSessionUsage {
  lastUpdated: string;
  model: string;
  increments: LocalCodexUsageIncrement[];
  usage: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningOutputTokens: number;
    totalTokens: number;
  };
}

interface LocalCodexUsageIncrement {
  timestamp: string;
  model: string;
  usage: LocalCodexSessionUsage["usage"];
}

function buildLocalCodexModelBreakdown(
  increments: LocalCodexUsageIncrement[],
): ModelTokenUsageSnapshot[] {
  const totalsByModel = new Map<string, ModelTokenUsageSnapshot>();

  for (const increment of increments) {
    const model = resolvePricingModel(increment.model);
    const existing = totalsByModel.get(model) ?? {
      model,
      cachedInputTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      reasoningOutputTokens: 0,
      totalTokens: 0,
    };

    totalsByModel.set(model, {
      model,
      cachedInputTokens:
        existing.cachedInputTokens + increment.usage.cachedInputTokens,
      inputTokens: existing.inputTokens + increment.usage.inputTokens,
      outputTokens: existing.outputTokens + increment.usage.outputTokens,
      reasoningOutputTokens:
        existing.reasoningOutputTokens + increment.usage.reasoningOutputTokens,
      totalTokens: existing.totalTokens + increment.usage.totalTokens,
    });
  }

  return Array.from(totalsByModel.values()).sort(
    (a, b) => b.totalTokens - a.totalTokens,
  );
}

function filterLocalCodexIncrements(
  increments: LocalCodexUsageIncrement[],
  period: { start: Date; end: Date },
): LocalCodexUsageIncrement[] {
  return increments.filter((increment) => {
    const timestamp = Date.parse(increment.timestamp);

    return !Number.isNaN(timestamp) &&
      timestamp >= period.start.getTime() &&
      timestamp < period.end.getTime();
  });
}

function extractLocalCodexSessionUsage(
  sessionFile: CodexSessionFile,
): LocalCodexSessionUsage | null {
  const events = sessionFile.content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as CodexJsonlEvent & CodexTurnContextEvent];
      } catch {
        return [];
      }
    });
  const tokenCountEvents = events.filter(
    (event) => event.payload?.type === "token_count",
  );
  const tokenCountEvent = tokenCountEvents.at(-1);

  if (
    !tokenCountEvent?.payload?.info?.total_token_usage ||
    typeof tokenCountEvent.timestamp !== "string"
  ) {
    return null;
  }

  const usage = normalizeTokenUsage(
    tokenCountEvent.payload.info.total_token_usage,
  );

  if (!usage) {
    return null;
  }

  return {
    lastUpdated: tokenCountEvent.timestamp,
    model: extractLatestModel(events) ?? DEFAULT_CODEX_PRICING_MODEL,
    increments: extractLocalCodexUsageIncrements(events),
    usage,
  };
}

function extractLocalCodexUsageIncrements(
  events: Array<CodexJsonlEvent & CodexTurnContextEvent>,
): LocalCodexUsageIncrement[] {
  let previousUsage: LocalCodexSessionUsage["usage"] = {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
    totalTokens: 0,
  };
  let model = DEFAULT_CODEX_PRICING_MODEL;

  return events.flatMap((event) => {
    if (
      event.type === "turn_context" &&
      typeof event.payload?.model === "string" &&
      event.payload.model
    ) {
      model = event.payload.model;
    }

    if (event.payload?.type !== "token_count") {
      return [];
    }

    const usage = event.payload?.info?.total_token_usage
      ? normalizeTokenUsage(event.payload.info.total_token_usage)
      : null;

    if (!usage || typeof event.timestamp !== "string") {
      return [];
    }

    const delta = subtractTokenUsage(usage, previousUsage);
    previousUsage = usage;

    if (delta.totalTokens <= 0) {
      return [];
    }

    return [
      {
        timestamp: event.timestamp,
        model,
        usage: delta,
      },
    ];
  });
}

function normalizeTokenUsage(
  usage: CodexTokenUsage,
): LocalCodexSessionUsage["usage"] | null {
  const inputTokens = toSafeTokenCount(usage.input_tokens);
  const cachedInputTokens = toSafeTokenCount(usage.cached_input_tokens);
  const outputTokens = toSafeTokenCount(usage.output_tokens);
  const reasoningOutputTokens = toSafeTokenCount(
    usage.reasoning_output_tokens,
  );
  const totalTokens =
    toSafeTokenCount(usage.total_tokens) ||
    inputTokens + outputTokens;

  if (totalTokens <= 0) {
    return null;
  }

  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningOutputTokens,
    totalTokens,
  };
}

function toSafeTokenCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

function subtractTokenUsage(
  current: LocalCodexSessionUsage["usage"],
  previous: LocalCodexSessionUsage["usage"],
): LocalCodexSessionUsage["usage"] {
  return {
    inputTokens: Math.max(0, current.inputTokens - previous.inputTokens),
    cachedInputTokens: Math.max(
      0,
      current.cachedInputTokens - previous.cachedInputTokens,
    ),
    outputTokens: Math.max(0, current.outputTokens - previous.outputTokens),
    reasoningOutputTokens: Math.max(
      0,
      current.reasoningOutputTokens - previous.reasoningOutputTokens,
    ),
    totalTokens: Math.max(0, current.totalTokens - previous.totalTokens),
  };
}

function estimatePeriodCostUsd(
  increments: LocalCodexUsageIncrement[],
  period: { start: Date; end: Date },
): number {
  return summarizePeriodUsage(increments, period).costUsd;
}

function summarizePeriodUsage(
  increments: LocalCodexUsageIncrement[],
  period: { start: Date; end: Date },
): { totalTokens: number; costUsd: number } {
  return increments.reduce((sum, increment) => {
    const timestamp = Date.parse(increment.timestamp);

    if (
      Number.isNaN(timestamp) ||
      timestamp < period.start.getTime() ||
      timestamp >= period.end.getTime()
    ) {
      return sum;
    }

    return {
      totalTokens: sum.totalTokens + increment.usage.totalTokens,
      costUsd: sum.costUsd + estimateCodexCostUsd(increment.usage, increment.model),
    };
  }, { totalTokens: 0, costUsd: 0 });
}

export function normalizeCodexUsdLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value * 100) / 100);
}

function toLimitPercent(costUsd: number, limitUsd: number): number {
  if (limitUsd <= 0) {
    return 0;
  }

  return (costUsd / limitUsd) * 100;
}

function getLocalUsagePeriods(now: Date): {
  day: { start: Date; end: Date };
  week: { start: Date; end: Date };
  month: { start: Date; end: Date };
} {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const weekStart = new Date(dayStart);
  const day = weekStart.getDay();
  const daysSinceMonday = (day + 6) % 7;
  weekStart.setDate(weekStart.getDate() - daysSinceMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    day: { start: dayStart, end: dayEnd },
    week: { start: weekStart, end: weekEnd },
    month: { start: monthStart, end: monthEnd },
  };
}

function getRecentLocalUsageDays(now: Date): Array<{ start: Date; end: Date }> {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - (6 - index));
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return { start, end };
  });
}

function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function extractLatestModel(
  events: Array<CodexJsonlEvent & CodexTurnContextEvent>,
): string | null {
  return (
    events
      .slice()
      .reverse()
      .find(
        (event) =>
          event.type === "turn_context" &&
          typeof event.payload?.model === "string" &&
          event.payload.model,
      )?.payload?.model ?? null
  );
}

function estimateCodexCostUsd(
  usage: Pick<
    LocalTokenUsageSnapshot,
    "cachedInputTokens" | "inputTokens" | "outputTokens"
  >,
  model: string,
): number {
  const pricing = CODEX_MODEL_PRICES_USD_PER_1M[resolvePricingModel(model)];
  const uncachedInputTokens = Math.max(
    0,
    usage.inputTokens - usage.cachedInputTokens,
  );

  return (
    (uncachedInputTokens / 1_000_000) * pricing.input +
    (usage.cachedInputTokens / 1_000_000) * pricing.cachedInput +
    (usage.outputTokens / 1_000_000) * pricing.output
  );
}

function resolvePricingModel(model: string): string {
  const normalized = model.toLowerCase();

  if (CODEX_MODEL_PRICES_USD_PER_1M[normalized]) {
    return normalized;
  }

  if (normalized.includes("mini")) {
    return "gpt-5.4-mini";
  }

  if (normalized.includes("5.4")) {
    return "gpt-5.4";
  }

  return DEFAULT_CODEX_PRICING_MODEL;
}
