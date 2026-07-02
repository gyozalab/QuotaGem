import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { SystemState, UsageDashboardState } from "./shared/dashboard";
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

// 把後端 { snapshots, preferences } 正規化成前端 UsageDashboardState。
// 根因修復：原本只有 fetchUsageState 做正規化，saveSettings / connectClaude
// 直接把後端原始回應（含 snapshots、無 providers）當成 UsageDashboardState 回傳，
// 導致 setDashboardState 後 providers=undefined，下一次 render 的
// filterProvidersByVisibility 對 undefined.filter() 丟 TypeError → 透明視窗整片空白
// （使用者看到的「切供應商後 app 跳掉」）。三個入口統一走此函式。
function toDashboardState(raw: RawUsageResponse): UsageDashboardState {
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
}

const ipcAdapter = {
  fetchUsageState: async (): Promise<UsageDashboardState> => {
    return toDashboardState(await invoke<RawUsageResponse>("fetch_usage_state"));
  },
  fetchSystemState: async (): Promise<SystemState> => {
    return invoke<SystemState>("fetch_system_state");
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
  refreshUsage: async (): Promise<void> => {
    return invoke<void>("refresh_usage");
  },
  connectClaude: async (
    preferences: UsageDashboardState["preferences"],
  ): Promise<UsageDashboardState> => {
    return toDashboardState(
      await invoke<RawUsageResponse>("connect_claude", { preferences }),
    );
  },
  saveSettings: async (
    preferences: UsageDashboardState["preferences"],
  ): Promise<UsageDashboardState> => {
    return toDashboardState(
      await invoke<RawUsageResponse>("save_settings", { preferences }),
    );
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
  onSettingsRequested: (callback: () => void) => {
    let unlistenFn: (() => void) | null = null;

    void listen<void>("settings:requested", () => {
      callback();
    }).then((unlisten) => {
      unlistenFn = unlisten;
    });

    return () => {
      unlistenFn?.();
    };
  },
};

// 掛載到 global window
(window as any).trayUsageWidget = ipcAdapter;
