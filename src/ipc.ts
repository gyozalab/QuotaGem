import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UsageDashboardState } from "./shared/dashboard";
import { normalizeProviderUsage, formatDateParts, type ProviderUsageSnapshot } from "./shared/usage";
import { t } from "./shared/i18n";

interface RawUsageResponse {
  snapshots: ProviderUsageSnapshot[];
  preferences: UsageDashboardState["preferences"];
}

function buildLastUpdatedLabel(
  snapshots: { lastUpdated: string }[],
  preferences: {
    language: any;
    timeDisplay: "utc" | "local";
    timeFormat: "24h" | "12h";
    dateFormat: any;
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

const ipcAdapter = {
  fetchUsageState: async (): Promise<UsageDashboardState> => {
    const raw = await invoke<RawUsageResponse>("fetch_usage_state");

    const providers = raw.snapshots.map((snapshot) =>
      normalizeProviderUsage(snapshot, {
        language: raw.preferences.language,
        timeDisplay: raw.preferences.timeDisplay,
        timeFormat: raw.preferences.timeFormat,
        dateFormat: raw.preferences.dateFormat,
        warningThreshold: raw.preferences.warningThreshold,
        dangerThreshold: raw.preferences.dangerThreshold,
      }),
    );

    const lastUpdatedLabel = buildLastUpdatedLabel(raw.snapshots, {
      language: raw.preferences.language,
      timeDisplay: raw.preferences.timeDisplay,
      timeFormat: raw.preferences.timeFormat,
      dateFormat: raw.preferences.dateFormat,
    });

    return {
      providers,
      lastUpdatedLabel,
      preferences: raw.preferences,
    };
  },
  syncExpandedLayout: async (layout: {
    contentHeight: number;
    settingsOpen: boolean;
  }): Promise<void> => {
    return invoke<void>("sync_expanded_layout", { layout });
  },
  openExpandedPanel: async (): Promise<void> => {
    return invoke<void>("open_expanded_panel");
  },
  openCompactPanel: async (): Promise<void> => {
    return invoke<void>("open_compact_panel");
  },
  closePanels: async (): Promise<void> => {
    return invoke<void>("close_panels");
  },
  connectClaude: async (): Promise<UsageDashboardState> => {
    return invoke<UsageDashboardState>("connect_claude");
  },
  saveSettings: async (
    preferences: UsageDashboardState["preferences"],
  ): Promise<UsageDashboardState> => {
    return invoke<UsageDashboardState>("save_settings", { preferences });
  },
  onRefreshRequested: (callback: () => void) => {
    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      unlistenFn = await listen<void>("usage:refreshRequested", () => {
        callback();
      });
    };

    setupListener();

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  },
};

// 掛載到 global window
(window as any).trayUsageWidget = ipcAdapter;
