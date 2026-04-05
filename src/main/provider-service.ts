import { app, BrowserWindow, session } from "electron";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type Store from "electron-store";

import {
  extractClaudeOrganizationId,
  extractClaudeUsage,
} from "../providers/claude";
import { extractLatestCodexUsage } from "../providers/codex";
import { extractGeminiLocalUsage } from "../providers/gemini";
import { loadProviderSnapshots } from "../providers";
import type { DateFormatPreference, UsageDashboardState } from "../shared/dashboard";
import { t, type WidgetLanguage } from "../shared/i18n";
import { normalizePanelScale } from "../shared/panel-scale";
import type { PanelTone } from "../shared/panel-themes";
import {
  formatDateParts,
  normalizeProviderUsage,
  normalizeUsageThresholds,
  type ProviderUsageSnapshot,
} from "../shared/usage";
import { resolveClaudeDebugPath } from "./runtime-paths";

export interface AppStoreShape {
  claudeSessionKey?: string;
  claudeOrganizationId?: string;
  geminiDailyLimit?: number;
  preferredDisplayMode?: "expanded" | "compact";
  launchAtLogin?: boolean;
  providerVisibility?: "both" | "all" | "claude" | "codex" | "gemini";
  refreshIntervalMinutes?: number;
  warningThreshold?: number;
  dangerThreshold?: number;
  notificationsEnabled?: boolean;
  notificationLevel?: "all" | "danger";
  language?: WidgetLanguage;
  timeDisplay?: "utc" | "local";
  timeFormat?: "24h" | "12h";
  dateFormat?: DateFormatPreference;
  panelScale?: number;
  panelOpacity?: number;
  panelTone?: PanelTone;
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

export function primeClaudeSession(): void {
  session.defaultSession.setUserAgent(CLAUDE_USER_AGENT);
}

export async function buildDashboardState(
  store: Store<AppStoreShape>,
  launchAtLogin = store.get("launchAtLogin", false),
): Promise<UsageDashboardState> {
  const thresholds = normalizeUsageThresholds({
    warningThreshold: store.get("warningThreshold", 75),
    dangerThreshold: store.get("dangerThreshold", 90),
  });
  const snapshots = await loadProviderSnapshots([
    {
      provider: "claude",
      displayName: "Claude",
      read: async () => readClaudeSnapshot(store),
    },
    {
      provider: "codex",
      displayName: "Codex",
      read: readCodexSnapshot,
    },
    {
      provider: "gemini",
      displayName: "Gemini",
      read: async () => readGeminiSnapshot(store),
    },
  ]);

  return {
    providers: snapshots.map((snapshot) =>
      normalizeProviderUsage(snapshot, {
        language: store.get("language", "en"),
        timeDisplay: store.get("timeDisplay", "utc"),
        timeFormat: store.get("timeFormat", "24h"),
        dateFormat: store.get("dateFormat", "iso"),
        warningThreshold: thresholds.warningThreshold,
        dangerThreshold: thresholds.dangerThreshold,
      }),
    ),
    lastUpdatedLabel: buildLastUpdatedLabel(snapshots, {
      language: store.get("language", "en"),
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
      language: store.get("language", "en"),
      timeDisplay: store.get("timeDisplay", "utc"),
      timeFormat: store.get("timeFormat", "24h"),
      dateFormat: store.get("dateFormat", "iso"),
      panelScale: normalizePanelScale(store.get("panelScale", 100)),
      panelOpacity: store.get("panelOpacity", 90),
      panelTone: store.get("panelTone", "charcoal"),
    },
  };
}

async function readCodexSnapshot(): Promise<ProviderUsageSnapshot | null> {
  const sessionsRoot = path.join(os.homedir(), ".codex", "sessions");
  const latestFile = await findNewestJsonlFile(sessionsRoot);

  if (!latestFile) {
    return null;
  }

  const content = await fs.readFile(latestFile, "utf8");
  return extractLatestCodexUsage(content);
}

async function findNewestJsonlFile(root: string): Promise<string | null> {
  const entries = await walkDirectory(root).catch(() => []);
  const jsonlFiles = entries.filter((entry) => entry.endsWith(".jsonl"));

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

const GEMINI_TMP_ROOT = path.join(os.homedir(), ".gemini", "tmp");
const GEMINI_DEFAULT_DAILY_LIMIT = 1500;

interface GeminiSessionFile {
  startTime?: string;
  messages?: Array<{
    type?: string;
    tokens?: { total?: number };
  }>;
}

async function readGeminiSnapshot(
  store: Store<AppStoreShape>,
): Promise<ProviderUsageSnapshot | null> {
  const sessionFiles = await findGeminiSessionFiles();

  if (sessionFiles.length === 0) {
    return null;
  }

  const sessions: GeminiSessionFile[] = [];
  for (const file of sessionFiles) {
    try {
      const content = await fs.readFile(file, "utf8");
      sessions.push(JSON.parse(content) as GeminiSessionFile);
    } catch {
      continue;
    }
  }

  const dailyLimit = store.get("geminiDailyLimit", GEMINI_DEFAULT_DAILY_LIMIT);
  return extractGeminiLocalUsage(sessions, {
    dailyLimit,
    lastUpdated: new Date().toISOString(),
  });
}

async function findGeminiSessionFiles(): Promise<string[]> {
  let projectDirs: string[];
  try {
    const entries = await fs.readdir(GEMINI_TMP_ROOT, { withFileTypes: true });
    projectDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(GEMINI_TMP_ROOT, entry.name, "chats"));
  } catch {
    return [];
  }

  const allFiles: string[] = [];
  for (const chatsDir of projectDirs) {
    try {
      const files = await fs.readdir(chatsDir);
      for (const file of files) {
        if (file.startsWith("session-") && file.endsWith(".json")) {
          allFiles.push(path.join(chatsDir, file));
        }
      }
    } catch {
      continue;
    }
  }

  return allFiles;
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
    timeDisplay: "utc" | "local";
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
  const locale = preferences.language === "zh-TW" ? "zh-TW" : "en-US";
  const parts = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: preferences.timeFormat === "12h",
    timeZone: preferences.timeDisplay === "utc" ? "UTC" : undefined,
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const dayPeriod = pick("dayPeriod");
  const suffix =
    preferences.timeDisplay === "utc"
      ? t(preferences.language, "utcSuffix")
      : t(preferences.language, "localSuffix");
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
