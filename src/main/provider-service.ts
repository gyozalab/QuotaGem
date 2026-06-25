import { app, BrowserWindow, session } from "electron";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type Store from "electron-store";

import {
  extractClaudeOrganizationId,
  extractClaudeUsage,
} from "../providers/claude";
import {
  extractLatestCodexUsage,
  extractLocalCodexUsage,
  normalizeCodexProviderMultiplier,
  normalizeCodexUsdLimit,
} from "../providers/codex";
import { extractLatestAgyUsage } from "../providers/agy";
import { loadProviderSnapshots, type ProviderReader } from "../providers";
import type {
  CodexDataSource,
  DateFormatPreference,
  UsageDashboardState,
} from "../shared/dashboard";
import {
  normalizeWidgetLanguage,
  t,
  type WidgetLanguage,
} from "../shared/i18n";
import { normalizePanelScale } from "../shared/panel-scale";
import type { PanelTone } from "../shared/panel-themes";
import {
  formatDateParts,
  type LocalTokenUsageSnapshot,
  type ModelTokenUsageSnapshot,
  normalizeProviderUsage,
  normalizeUsageThresholds,
  type ProviderId,
  type ProviderUsageSnapshot,
} from "../shared/usage";
import { resolveClaudeDebugPath } from "./runtime-paths";

const require = createRequire(__filename);
const execFileAsync = promisify(execFile);

export interface AppStoreShape {
  claudeSessionKey?: string;
  claudeOrganizationId?: string;
  preferredDisplayMode?: "expanded" | "compact";
  launchAtLogin?: boolean;
  providerVisibility?: "both" | "claude" | "codex" | "agy";
  refreshIntervalMinutes?: number;
  warningThreshold?: number;
  dangerThreshold?: number;
  notificationsEnabled?: boolean;
  notificationLevel?: "all" | "danger";
  language?: WidgetLanguage;
  timeDisplay?: "utc" | "local" | "taipei";
  timeFormat?: "24h" | "12h";
  dateFormat?: DateFormatPreference;
  panelScale?: number;
  panelOpacity?: number;
  panelTone?: PanelTone;
  codexDataSource?: CodexDataSource;
  codexProviderMultiplier?: number;
  codexDailyLimitUsd?: number;
  codexWeeklyLimitUsd?: number;
  codexMonthlyLimitUsd?: number;
  claudeShowRemainingUsage?: boolean;
  codexShowRemainingUsage?: boolean;
  antigravityShowRemainingUsage?: boolean;
}

interface BuildDashboardStateOptions {
  visibleProviders?: ProviderId[];
}

const CLAUDE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

const CLAUDE_BLOCKED_SIGNATURES = [
  { pattern: "Just a moment", error: "CloudflareBlocked" },
  {
    pattern: "Enable JavaScript and cookies to continue",
    error: "CloudflareChallenge",
  },
  { pattern: "<html", error: "UnexpectedHTML" },
];

const CCUSAGE_BINARY_PACKAGES: Partial<
  Record<NodeJS.Platform, Partial<Record<NodeJS.Architecture, string>>>
> = {
  darwin: {
    arm64: "@ccusage/ccusage-darwin-arm64",
    x64: "@ccusage/ccusage-darwin-x64",
  },
  linux: {
    arm64: "@ccusage/ccusage-linux-arm64",
    x64: "@ccusage/ccusage-linux-x64",
  },
  win32: {
    arm64: "@ccusage/ccusage-win32-arm64",
    x64: "@ccusage/ccusage-win32-x64",
  },
};

const CCUSAGE_PROVIDER_SOURCES: Partial<Record<ProviderId, string>> = {
  agy: "gemini",
  claude: "claude",
  codex: "codex",
};

interface CcusageDailyReport {
  daily?: CcusageDailyRow[];
  totals?: Partial<CcusageTokenTotals>;
}

interface CcusageDailyRow extends Partial<CcusageTokenTotals> {
  cost?: number;
  costUSD?: number;
  date?: string;
  modelBreakdowns?: Array<{ modelName?: string } & Partial<CcusageModelUsage>>;
  models?: Record<string, CcusageModelUsage>;
  modelsUsed?: string[];
  period?: string;
  totalCost?: number;
}

interface CcusageModelUsage extends Partial<CcusageTokenTotals> {
  isFallback?: boolean;
}

interface CcusageTokenTotals {
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUSD: number;
  inputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalCost: number;
  totalTokens: number;
}

export function primeClaudeSession(): void {
  session.defaultSession.setUserAgent(CLAUDE_USER_AGENT);
}

export async function buildDashboardState(
  store: Store<AppStoreShape>,
  launchAtLogin = store.get("launchAtLogin", false),
  options: BuildDashboardStateOptions = {},
): Promise<UsageDashboardState> {
  const thresholds = normalizeUsageThresholds({
    warningThreshold: store.get("warningThreshold", 75),
    dangerThreshold: store.get("dangerThreshold", 90),
  });
  const language = normalizeWidgetLanguage(store.get("language", "en"));
  const requestedProviders = new Set(
    options.visibleProviders ?? ["claude", "codex", "agy"],
  );
  const allReaders: ProviderReader[] = [
    {
      provider: "claude",
      displayName: "Claude",
      read: async () => readClaudeSnapshot(store),
    },
    {
      provider: "codex",
      displayName: "Codex",
      read: async () => readCodexSnapshot(store),
    },
    {
      provider: "agy",
      displayName: "Agy",
      read: readAgySnapshot,
    },
  ];
  const readers = allReaders.filter((reader) =>
    requestedProviders.has(reader.provider),
  );
  const snapshots = await loadProviderSnapshots(readers, {
    timeoutMsByProvider: {
      claude: 8000,
    },
  });
  const snapshotsWithHistory = await attachCcusageHistory(
    snapshots,
    store,
  );

  return {
    providers: snapshotsWithHistory.map((snapshot) =>
      normalizeProviderUsage(snapshot, {
        language,
        timeDisplay: "taipei",
        timeFormat: store.get("timeFormat", "24h"),
        dateFormat: store.get("dateFormat", "iso"),
        warningThreshold: thresholds.warningThreshold,
        dangerThreshold: thresholds.dangerThreshold,
        showRemainingUsageByProvider: {
          claude: store.get("claudeShowRemainingUsage", false),
          codex: store.get("codexShowRemainingUsage", false),
          agy: store.get("antigravityShowRemainingUsage", false),
        },
      }),
    ),
    lastUpdatedLabel: buildLastUpdatedLabel(snapshotsWithHistory, {
      language,
      timeDisplay: store.get("timeDisplay", "utc"),
      timeFormat: store.get("timeFormat", "24h"),
      dateFormat: store.get("dateFormat", "iso"),
    }),
    preferences: {
      preferredDisplayMode: store.get("preferredDisplayMode", "expanded"),
      launchAtLogin,
      providerVisibility: store.get("providerVisibility", "both"),
      refreshIntervalMinutes: store.get("refreshIntervalMinutes", 5),
      warningThreshold: thresholds.warningThreshold,
      dangerThreshold: thresholds.dangerThreshold,
      notificationsEnabled: store.get("notificationsEnabled", true),
      notificationLevel: store.get("notificationLevel", "all"),
      language,
      timeDisplay: store.get("timeDisplay", "utc"),
      timeFormat: store.get("timeFormat", "24h"),
      dateFormat: store.get("dateFormat", "iso"),
      panelScale: normalizePanelScale(store.get("panelScale", 100)),
      panelOpacity: store.get("panelOpacity", 90),
      panelTone: store.get("panelTone", "charcoal"),
      codexDataSource: store.get("codexDataSource", "official"),
      codexProviderMultiplier: normalizeCodexProviderMultiplier(
        store.get("codexProviderMultiplier", 1),
      ),
      codexDailyLimitUsd: store.get("codexDailyLimitUsd", 10),
      codexWeeklyLimitUsd: store.get("codexWeeklyLimitUsd", 50),
      codexMonthlyLimitUsd: store.get("codexMonthlyLimitUsd", 200),
      claudeShowRemainingUsage: store.get("claudeShowRemainingUsage", false),
      codexShowRemainingUsage: store.get("codexShowRemainingUsage", false),
      antigravityShowRemainingUsage: store.get(
        "antigravityShowRemainingUsage",
        false,
      ),
    },
  };
}

async function attachCcusageHistory(
  snapshots: ProviderUsageSnapshot[],
  store: Store<AppStoreShape>,
): Promise<ProviderUsageSnapshot[]> {
  const historyEntries = await Promise.all(
    snapshots.map(async (snapshot) => ({
      history: await readCcusageLocalUsage(snapshot.provider, store),
      snapshot,
    })),
  );

  return historyEntries.map(({ history, snapshot }) => {
    if (!history) {
      return snapshot;
    }

    const localUsagePrimary = snapshot.localUsagePrimary === true;
    const nextSnapshot: ProviderUsageSnapshot = {
      ...snapshot,
      localUsage: history,
      localUsagePrimary,
    };

    if (localUsagePrimary) {
      const periods = getCcusagePeriods(new Date());
      nextSnapshot.sessionPercent = toLimitPercent(
        history.dailyCostUsd,
        history.dailyLimitUsd,
      );
      nextSnapshot.sessionResetAt = periods.day.end;
      nextSnapshot.weeklyPercent = toLimitPercent(
        history.weeklyCostUsd,
        history.weeklyLimitUsd,
      );
      nextSnapshot.weeklyResetAt = periods.week.end;
      nextSnapshot.monthlyPercent = toLimitPercent(
        history.monthlyCostUsd,
        history.monthlyLimitUsd,
      );
      nextSnapshot.monthlyResetAt = periods.month.end;
    }

    console.info(
      `【ccusage历史数据】已附加：provider=${snapshot.provider}, totalTokens=${history.totalTokens}, totalCostUsd=${history.estimatedCostUsd.toFixed(4)}, days=${history.recentDailyUsage.length}, models=${history.modelBreakdown.length}`,
    );

    return nextSnapshot;
  });
}

async function readCcusageLocalUsage(
  provider: ProviderId,
  store: Store<AppStoreShape>,
): Promise<LocalTokenUsageSnapshot | null> {
  const source = CCUSAGE_PROVIDER_SOURCES[provider];

  if (!source) {
    return null;
  }

  const startedAt = Date.now();

  try {
    const report = await readCcusageDailyReport(source);
    const usage = buildCcusageLocalUsage(provider, report, store);

    if (!usage) {
      console.info(
        `【ccusage历史数据】无可用数据：provider=${provider}, source=${source}, elapsedMs=${Date.now() - startedAt}`,
      );
      return null;
    }

    console.info(
      `【ccusage历史数据】读取成功：provider=${provider}, source=${source}, totalTokens=${usage.totalTokens}, totalCostUsd=${usage.estimatedCostUsd.toFixed(4)}, models=${usage.modelBreakdown.length}, elapsedMs=${Date.now() - startedAt}`,
    );
    return usage;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.info(
      `【ccusage历史数据】读取失败：provider=${provider}, source=${source}, reason=${reason}, elapsedMs=${Date.now() - startedAt}`,
    );
    return null;
  }
}

async function readCcusageDailyReport(
  source: string,
): Promise<CcusageDailyReport> {
  const binaryPath = await resolveCcusageBinaryPath();
  const { stdout } = await execFileAsync(
    binaryPath,
    [source, "daily", "--json", "--offline"],
    {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 8000,
      windowsHide: true,
    },
  );

  return JSON.parse(stdout) as CcusageDailyReport;
}

async function resolveCcusageBinaryPath(): Promise<string> {
  const nativePackage = CCUSAGE_BINARY_PACKAGES[process.platform]?.[process.arch];
  if (!nativePackage) {
    throw new Error(`unsupported-platform-${process.platform}-${process.arch}`);
  }

  const binarySubpath = process.platform === "win32"
    ? "bin/ccusage.exe"
    : "bin/ccusage";
  const candidates: string[] = [];

  try {
    candidates.push(require.resolve(`${nativePackage}/${binarySubpath}`));
  } catch {
    // Fall through to path candidates below.
  }

  if (process.resourcesPath) {
    candidates.push(
      path.join(
        process.resourcesPath,
        "app.asar.unpacked",
        "node_modules",
        nativePackage,
        binarySubpath,
      ),
      path.join(
        process.resourcesPath,
        "app",
        "node_modules",
        nativePackage,
        binarySubpath,
      ),
    );
  }

  candidates.push(
    path.join(process.cwd(), "node_modules", nativePackage, binarySubpath),
  );

  for (const candidate of candidates.map((candidate) =>
    candidate.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`),
  )) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(`ccusage-binary-not-found:${nativePackage}`);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function buildCcusageLocalUsage(
  provider: ProviderId,
  report: CcusageDailyReport,
  store: Store<AppStoreShape>,
): LocalTokenUsageSnapshot | null {
  const rows = (report.daily ?? [])
    .map(normalizeCcusageDailyRow)
    .filter((row): row is NormalizedCcusageDailyRow => row !== null);

  if (rows.length === 0) {
    return null;
  }

  const multiplier = provider === "codex"
    ? normalizeCodexProviderMultiplier(store.get("codexProviderMultiplier", 1))
    : 1;
  const totals = rows.reduce(
    (result, row) => ({
      cacheCreationTokens: result.cacheCreationTokens + row.cacheCreationTokens,
      cacheReadTokens: result.cacheReadTokens + row.cacheReadTokens,
      costUsd: result.costUsd + row.costUsd,
      inputTokens: result.inputTokens + row.inputTokens,
      outputTokens: result.outputTokens + row.outputTokens,
      reasoningOutputTokens:
        result.reasoningOutputTokens + row.reasoningOutputTokens,
      totalTokens: result.totalTokens + row.totalTokens,
    }),
    {
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      costUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
      reasoningOutputTokens: 0,
      totalTokens: 0,
    },
  );
  const modelBreakdown = buildCcusageModelBreakdown(rows);
  const periods = getCcusagePeriods(new Date());
  const rowsByDate = new Map(rows.map((row) => [row.date, row]));
  const dailyRows = filterCcusageRowsByDateRange(rows, periods.day);
  const weeklyRows = filterCcusageRowsByDateRange(rows, periods.week);
  const monthlyRows = filterCcusageRowsByDateRange(rows, periods.month);
  const dailyTotals = summarizeCcusageRows(dailyRows);
  const weeklyTotals = summarizeCcusageRows(weeklyRows);
  const monthlyTotals = summarizeCcusageRows(monthlyRows);
  const recentDailyUsage = getRecentCcusageDateKeys(new Date()).map((date) => {
    const row = rowsByDate.get(date);

    return {
      costUsd: (row?.costUsd ?? 0) * multiplier,
      date,
      totalTokens: row?.totalTokens ?? 0,
    };
  });
  const pricingModels = Array.from(
    new Set(rows.flatMap((row) => row.modelsUsed)),
  ).filter(Boolean);
  const pricingModel = pricingModels.length === 0
    ? "unknown"
    : pricingModels.length === 1
      ? pricingModels[0]
      : "mixed";

  return {
    source: "ccusage",
    cachedInputTokens: totals.cacheReadTokens,
    dailyCostUsd: dailyTotals.costUsd * multiplier,
    dailyLimitUsd: normalizeCodexUsdLimit(store.get("codexDailyLimitUsd", 10)),
    dailyTokens: dailyTotals.totalTokens,
    estimatedCostUsd: totals.costUsd * multiplier,
    inputTokens: totals.inputTokens,
    model: pricingModel,
    modelBreakdown,
    dailyModelBreakdown: buildCcusageModelBreakdown(dailyRows),
    monthlyCostUsd: monthlyTotals.costUsd * multiplier,
    monthlyLimitUsd: normalizeCodexUsdLimit(
      store.get("codexMonthlyLimitUsd", 200),
    ),
    outputTokens: totals.outputTokens,
    pricingModel,
    providerMultiplier: multiplier,
    reasoningOutputTokens: totals.reasoningOutputTokens,
    recentDailyUsage,
    sessionCount: rows.length,
    totalTokens: totals.totalTokens,
    weeklyCostUsd: weeklyTotals.costUsd * multiplier,
    weeklyModelBreakdown: buildCcusageModelBreakdown(weeklyRows),
    weeklyLimitUsd: normalizeCodexUsdLimit(store.get("codexWeeklyLimitUsd", 50)),
    weeklyTokens: weeklyTotals.totalTokens,
  };
}

interface NormalizedCcusageDailyRow {
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  date: string;
  inputTokens: number;
  modelBreakdowns: ModelTokenUsageSnapshot[];
  modelsUsed: string[];
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
}

function normalizeCcusageDailyRow(
  row: CcusageDailyRow,
): NormalizedCcusageDailyRow | null {
  const date = row.date ?? row.period;

  if (!date) {
    return null;
  }

  return {
    cacheCreationTokens: toFiniteNumber(row.cacheCreationTokens),
    cacheReadTokens: toFiniteNumber(row.cacheReadTokens),
    costUsd: toFiniteNumber(row.costUSD ?? row.totalCost ?? row.cost),
    date,
    inputTokens: toFiniteNumber(row.inputTokens),
    modelBreakdowns: extractCcusageModelBreakdowns(row),
    modelsUsed: extractCcusageModels(row),
    outputTokens: toFiniteNumber(row.outputTokens),
    reasoningOutputTokens: toFiniteNumber(row.reasoningOutputTokens),
    totalTokens: toFiniteNumber(row.totalTokens),
  };
}

function buildCcusageModelBreakdown(
  rows: NormalizedCcusageDailyRow[],
): ModelTokenUsageSnapshot[] {
  const modelTotals = new Map<
    string,
    ModelTokenUsageSnapshot
  >();

  for (const row of rows) {
    for (const entry of row.modelBreakdowns) {
      const existing = modelTotals.get(entry.model) ?? {
        model: entry.model,
        cachedInputTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        reasoningOutputTokens: 0,
        totalTokens: 0,
        isFallback: false,
      };

      modelTotals.set(entry.model, {
        model: entry.model,
        cachedInputTokens: existing.cachedInputTokens + entry.cachedInputTokens,
        inputTokens: existing.inputTokens + entry.inputTokens,
        outputTokens: existing.outputTokens + entry.outputTokens,
        reasoningOutputTokens:
          existing.reasoningOutputTokens + entry.reasoningOutputTokens,
        totalTokens: existing.totalTokens + entry.totalTokens,
        isFallback: existing.isFallback || entry.isFallback,
      });
    }
  }

  return Array.from(modelTotals.values()).sort(
    (a, b) => b.totalTokens - a.totalTokens,
  );
}

function extractCcusageModelBreakdowns(
  row: CcusageDailyRow,
): ModelTokenUsageSnapshot[] {
  if (row.models && Object.keys(row.models).length > 0) {
    return Object.entries(row.models).map(([model, usage]) =>
      normalizeCcusageModelUsage(model, usage),
    );
  }

  if (row.modelBreakdowns?.length) {
    return row.modelBreakdowns
      .map((breakdown) =>
        breakdown.modelName
          ? normalizeCcusageModelUsage(breakdown.modelName, breakdown)
          : null,
      )
      .filter(
        (breakdown): breakdown is ModelTokenUsageSnapshot =>
          breakdown !== null,
      );
  }

  const models = extractCcusageModels(row);
  if (models.length === 1) {
    return [
      normalizeCcusageModelUsage(models[0], {
        cacheCreationTokens: row.cacheCreationTokens,
        cacheReadTokens: row.cacheReadTokens,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        reasoningOutputTokens: row.reasoningOutputTokens,
        totalTokens: row.totalTokens,
      }),
    ];
  }

  return [];
}

function normalizeCcusageModelUsage(
  model: string,
  usage: CcusageModelUsage,
): ModelTokenUsageSnapshot {
  return {
    model,
    cachedInputTokens: toFiniteNumber(usage.cacheReadTokens),
    inputTokens: toFiniteNumber(usage.inputTokens),
    outputTokens: toFiniteNumber(usage.outputTokens),
    reasoningOutputTokens: toFiniteNumber(usage.reasoningOutputTokens),
    totalTokens: toFiniteNumber(usage.totalTokens),
    isFallback: usage.isFallback,
  };
}

function extractCcusageModels(row: CcusageDailyRow): string[] {
  if (row.modelsUsed?.length) {
    return row.modelsUsed;
  }

  if (row.models) {
    return Object.keys(row.models);
  }

  if (row.modelBreakdowns?.length) {
    return row.modelBreakdowns
      .map((breakdown) => breakdown.modelName)
      .filter((model): model is string => Boolean(model));
  }

  return [];
}

function toFiniteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getCcusagePeriods(now: Date): {
  day: { start: string; end: string };
  month: { start: string; end: string };
  week: { start: string; end: string };
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
    day: { start: formatCcusageDateKey(dayStart), end: formatCcusageDateKey(dayEnd) },
    month: { start: formatCcusageDateKey(monthStart), end: formatCcusageDateKey(monthEnd) },
    week: { start: formatCcusageDateKey(weekStart), end: formatCcusageDateKey(weekEnd) },
  };
}

function filterCcusageRowsByDateRange(
  rows: NormalizedCcusageDailyRow[],
  range: { start: string; end: string },
): NormalizedCcusageDailyRow[] {
  return rows.filter((row) => row.date >= range.start && row.date < range.end);
}

function summarizeCcusageRows(rows: NormalizedCcusageDailyRow[]): {
  costUsd: number;
  totalTokens: number;
} {
  return rows.reduce(
    (result, row) => ({
      costUsd: result.costUsd + row.costUsd,
      totalTokens: result.totalTokens + row.totalTokens,
    }),
    { costUsd: 0, totalTokens: 0 },
  );
}

function getRecentCcusageDateKeys(now: Date): string[] {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - (6 - index));
    return formatCcusageDateKey(start);
  });
}

function formatCcusageDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toLimitPercent(costUsd: number, limitUsd: number): number {
  if (limitUsd <= 0) {
    return 0;
  }

  return (costUsd / limitUsd) * 100;
}

async function readCodexSnapshot(
  store: Store<AppStoreShape>,
): Promise<ProviderUsageSnapshot | null> {
  if (store.get("codexDataSource", "official") === "local") {
    return readLocalCodexSnapshot(store);
  }

  const [officialSnapshot, localSnapshot] = await Promise.all([
    readOfficialCodexSnapshot(),
    readLocalCodexSnapshot(store),
  ]);

  if (!officialSnapshot) {
    return localSnapshot
      ? { ...localSnapshot, localUsagePrimary: true }
      : null;
  }

  if (!localSnapshot?.localUsage) {
    return officialSnapshot;
  }

  console.info(
    `【Codex本地数据】附加官方源历史图表：sessions=${localSnapshot.localUsage.sessionCount}, totalTokens=${localSnapshot.localUsage.totalTokens}`,
  );

  return {
    ...officialSnapshot,
    localUsage: localSnapshot.localUsage,
    localUsagePrimary: false,
  };
}

async function readOfficialCodexSnapshot(): Promise<ProviderUsageSnapshot | null> {
  const sessionsRoot = path.join(os.homedir(), ".codex", "sessions");
  const startedAt = Date.now();
  console.info(`【Codex官方数据】开始读取：sessionsRoot=${sessionsRoot}`);
  const latestFile = await findNewestJsonlFile(sessionsRoot);

  if (!latestFile) {
    console.info(
      `【Codex官方数据】读取失败：reason=no-jsonl-file, sessionsRoot=${sessionsRoot}, elapsedMs=${Date.now() - startedAt}`,
    );
    return null;
  }

  const content = await fs.readFile(latestFile, "utf8");
  const snapshot = extractLatestCodexUsage(content);

  if (snapshot) {
    console.info(
      `【Codex官方数据】读取成功：file=${latestFile}, sessionPercent=${snapshot.sessionPercent.toFixed(2)}, weeklyPercent=${snapshot.weeklyPercent.toFixed(2)}, elapsedMs=${Date.now() - startedAt}`,
    );
  } else {
    console.info(
      `【Codex官方数据】读取失败：reason=no-token-count-event, file=${latestFile}, elapsedMs=${Date.now() - startedAt}`,
    );
  }

  return snapshot;
}

async function readLocalCodexSnapshot(
  store: Store<AppStoreShape>,
): Promise<ProviderUsageSnapshot | null> {
  const sessionsRoot = path.join(os.homedir(), ".codex", "sessions");
  const sessionFiles = await findJsonlFiles(sessionsRoot);
  const filesWithContent = await Promise.all(
    sessionFiles.map(async (file) => ({
      file,
      content: await fs.readFile(file, "utf8"),
    })),
  );
  const snapshot = extractLocalCodexUsage(filesWithContent, {
    dailyLimitUsd: store.get("codexDailyLimitUsd", 10),
    monthlyLimitUsd: store.get("codexMonthlyLimitUsd", 200),
    providerMultiplier: store.get("codexProviderMultiplier", 1),
    weeklyLimitUsd: store.get("codexWeeklyLimitUsd", 50),
  });

  if (snapshot?.localUsage) {
    console.info(
      `【Codex本地数据】读取成功：sessions=${snapshot.localUsage.sessionCount}, totalTokens=${snapshot.localUsage.totalTokens}, multiplier=${snapshot.localUsage.providerMultiplier}, dailyCostUsd=${snapshot.localUsage.dailyCostUsd.toFixed(4)}, weeklyCostUsd=${snapshot.localUsage.weeklyCostUsd.toFixed(4)}, monthlyCostUsd=${snapshot.localUsage.monthlyCostUsd.toFixed(4)}`,
    );
  } else {
    console.info(
      `【Codex本地数据】读取失败：reason=no-token-count-events, sessionsRoot=${sessionsRoot}`,
    );
  }

  return snapshot;
}

async function readAgySnapshot(): Promise<ProviderUsageSnapshot | null> {
  const agyFile = path.join(
    os.homedir(),
    "Library/Mobile Documents/com~apple~CloudDocs/Claude/QuotaGem/agy-monitor/agy-usage.jsonl",
  );
  const content = await fs.readFile(agyFile, "utf8").catch(() => null);
  if (!content) return null;
  return extractLatestAgyUsage(content);
}

async function findNewestJsonlFile(root: string): Promise<string | null> {
  const jsonlFiles = await findJsonlFiles(root);

  if (jsonlFiles.length === 0) {
    return null;
  }

  const filesWithStats = await Promise.all(
    jsonlFiles.map(async (file) => ({
      file,
      stat: await fs.stat(file),
    })),
  );

  filesWithStats.sort(
    (left, right) => right.stat.mtimeMs - left.stat.mtimeMs,
  );

  return filesWithStats[0]?.file ?? null;
}

async function findJsonlFiles(root: string): Promise<string[]> {
  const entries = await walkDirectory(root).catch(() => []);
  return entries.filter((entry) => entry.endsWith(".jsonl"));
}

async function walkDirectory(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return walkDirectory(entryPath);
      }
      return [entryPath];
    }),
  );

  return nested.flat();
}

async function readClaudeSnapshot(
  store: Store<AppStoreShape>,
): Promise<ProviderUsageSnapshot | null> {
  const sessionKey =
    process.env.CLAUDE_SESSION_KEY ?? store.get("claudeSessionKey");
  const organizationId =
    process.env.CLAUDE_ORGANIZATION_ID ?? store.get("claudeOrganizationId");

  if (!sessionKey || !organizationId) {
    await writeClaudeDebug({
      stage: "read",
      outcome: "missing-credentials",
    });
    return null;
  }

  try {
    return await readClaudeSnapshotFromCredentials(sessionKey, organizationId);
  } catch (error) {
    await writeClaudeDebug({
      stage: "read",
      outcome: "error",
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function readClaudeSnapshotFromCredentials(
  sessionKey: string,
  organizationId: string,
): Promise<ProviderUsageSnapshot | null> {
  if (!sessionKey || !organizationId) {
    return null;
  }

  await setClaudeSessionCookie(sessionKey);

  const payload = await fetchJsonViaHiddenWindow(
    `https://claude.ai/api/organizations/${organizationId}/usage`,
  );

  if (!payload || typeof payload !== "object") {
    await writeClaudeDebug({
      stage: "usage",
      outcome: "empty-payload",
    });
    return null;
  }

  const snapshot = extractClaudeUsage(payload, {
    lastUpdated: new Date().toISOString(),
  });

  await writeClaudeDebug({
    stage: "usage",
    outcome: snapshot ? "parsed" : "unparsed",
    payloadKeys: Object.keys(payload as Record<string, unknown>),
    fiveHourValue: (payload as Record<string, unknown>).five_hour,
    fiveHourKeys:
      typeof (payload as Record<string, unknown>).five_hour === "object" &&
      (payload as Record<string, unknown>).five_hour !== null
        ? Object.keys(
            (payload as Record<string, unknown>).five_hour as Record<string, unknown>,
          )
        : undefined,
    sevenDayValue: (payload as Record<string, unknown>).seven_day,
    sevenDayKeys:
      typeof (payload as Record<string, unknown>).seven_day === "object" &&
      (payload as Record<string, unknown>).seven_day !== null
        ? Object.keys(
            (payload as Record<string, unknown>).seven_day as Record<string, unknown>,
          )
        : undefined,
  });

  return snapshot;
}

export async function resolveClaudeOrganizationId(
  sessionKey: string,
): Promise<string | null> {
  if (!sessionKey) {
    return null;
  }

  await setClaudeSessionCookie(sessionKey);

  const payload = await fetchJsonViaHiddenWindow(
    "https://claude.ai/api/organizations",
  );

  if (!Array.isArray(payload)) {
    await writeClaudeDebug({
      stage: "organization",
      outcome: "unexpected-payload",
      payloadKeys:
        payload && typeof payload === "object"
          ? Object.keys(payload as Record<string, unknown>)
          : undefined,
    });
    return null;
  }

  await writeClaudeDebug({
    stage: "organization",
    outcome: "resolved",
    organizationCount: payload.length,
  });

  return extractClaudeOrganizationId(payload);
}

async function fetchJsonViaHiddenWindow(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const hiddenWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const timeout = setTimeout(() => {
      hiddenWindow.close();
      reject(new Error("Request timeout"));
    }, 30000);

    hiddenWindow.webContents.setUserAgent(CLAUDE_USER_AGENT);

    hiddenWindow.webContents.on("did-finish-load", async () => {
      try {
        const bodyText = await hiddenWindow.webContents.executeJavaScript(
          "document.body.innerText || document.body.textContent",
        );

        clearTimeout(timeout);
        hiddenWindow.close();

        if (typeof bodyText !== "string") {
          reject(new Error("Unexpected response body"));
          return;
        }

        for (const signature of CLAUDE_BLOCKED_SIGNATURES) {
          if (bodyText.includes(signature.pattern)) {
            reject(new Error(`${signature.error}: ${bodyText.substring(0, 200)}`));
            return;
          }
        }

        try {
          resolve(JSON.parse(bodyText) as unknown);
        } catch {
          reject(new Error(`InvalidJSON: ${bodyText.substring(0, 200)}`));
        }
      } catch (error) {
        clearTimeout(timeout);
        hiddenWindow.close();
        reject(error);
      }
    });

    hiddenWindow.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription) => {
        clearTimeout(timeout);
        hiddenWindow.close();
        reject(new Error(`LoadFailed: ${errorCode} ${errorDescription}`));
      },
    );

    void hiddenWindow.loadURL(url);
  });
}

async function setClaudeSessionCookie(sessionKey: string): Promise<void> {
  primeClaudeSession();
  await session.defaultSession.cookies.set({
    url: "https://claude.ai",
    name: "sessionKey",
    value: sessionKey,
    domain: ".claude.ai",
    path: "/",
    secure: true,
    httpOnly: true,
  });
}

async function writeClaudeDebug(entry: Record<string, unknown>): Promise<void> {
  await fs
    .writeFile(
      resolveClaudeDebugPath({
        appPath: app.getAppPath(),
        isPackaged: app.isPackaged,
        userDataPath: app.getPath("userData"),
      }),
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          ...entry,
        },
        null,
        2,
      ),
      "utf8",
    )
    .catch(() => {});
}

function buildLastUpdatedLabel(
  snapshots: ProviderUsageSnapshot[],
  preferences: {
    language: WidgetLanguage;
    timeDisplay: "utc" | "local" | "taipei";
    timeFormat: "24h" | "12h";
    dateFormat: DateFormatPreference;
  },
): string {
  const successfulTimestamps = snapshots
    .map((snapshot) => snapshot.lastUpdated)
    .filter(Boolean);

  if (successfulTimestamps.length === 0) {
    return t(preferences.language, "waitingForProviderData");
  }

  const latestTimestamp = successfulTimestamps.sort().at(-1);

  if (!latestTimestamp) {
    return t(preferences.language, "waitingForProviderData");
  }

  const elapsedMs = Date.now() - Date.parse(latestTimestamp);

  if (elapsedMs < 60_000) {
    return t(preferences.language, "updatedJustNow");
  }

  const elapsedMinutes = Math.round(elapsedMs / 60_000);

  if (elapsedMinutes < 60) {
    return t(preferences.language, "updatedMinutesAgo", { minutes: elapsedMinutes });
  }

  const date = new Date(latestTimestamp);
  const locale =
    preferences.language === "zh-TW" ? "zh-TW" :
    preferences.language === "zh-CN" ? "zh-CN" :
    "en-US";
  const parts = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: preferences.timeFormat === "12h",
    timeZone:
      preferences.timeDisplay === "utc" ? "UTC" :
      preferences.timeDisplay === "taipei" ? "Asia/Taipei" :
      undefined,
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const dayPeriod = pick("dayPeriod");
  const suffix =
    preferences.timeDisplay === "utc" ? t(preferences.language, "utcSuffix") :
    preferences.timeDisplay === "taipei" ? t(preferences.language, "taipeiSuffix") :
    t(preferences.language, "localSuffix");
  const formattedDate = formatDateParts({
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    dateFormat: preferences.dateFormat,
  });

  return t(preferences.language, "updatedAt", {
    time: `${formattedDate} ${pick("hour")}:${pick("minute")}${dayPeriod ? ` ${dayPeriod.toUpperCase()}` : ""} ${suffix}`,
  });
}
