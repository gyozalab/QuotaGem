import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import type { ProviderVisibility, UsageDashboardState } from "../shared/dashboard";
import { t, type WidgetLanguage } from "../shared/i18n";
import {
  getPanelScaleFromSliderIndex,
  getPanelScaleSliderIndex,
  PANEL_SCALE_OPTIONS,
} from "../shared/panel-scale";
import {
  getPanelThemeStyles,
  PANEL_THEME_OPTIONS,
  type PanelTone,
} from "../shared/panel-themes";
import { filterProvidersByVisibility } from "../shared/provider-visibility";
import { type NormalizedProviderUsage } from "../shared/usage";
import { UsagePanel } from "./UsagePanel";
import "./styles.css";

type SurfaceMode = "expanded" | "compact";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const DEFAULT_PROVIDERS: NormalizedProviderUsage[] = [
  {
    provider: "claude",
    displayName: "Claude",
    health: "unavailable",
    session: { label: "Session", percent: 0, resetLabel: "Unavailable", level: "normal" },
    weekly: { label: "Weekly", percent: 0, resetLabel: "Unavailable", level: "normal" },
    lastUpdated: "",
  },
  {
    provider: "codex",
    displayName: "Codex",
    health: "unavailable",
    session: { label: "Session", percent: 0, resetLabel: "Unavailable", level: "normal" },
    weekly: { label: "Weekly", percent: 0, resetLabel: "Unavailable", level: "normal" },
    lastUpdated: "",
  },
];

function getSurfaceMode(): SurfaceMode {
  const params = new URLSearchParams(window.location.search);
  return params.get("mode") === "compact" ? "compact" : "expanded";
}

function App() {
  const [dashboardState, setDashboardState] = useState<UsageDashboardState>({
    providers: DEFAULT_PROVIDERS,
    lastUpdatedLabel: "Waiting for provider data",
    preferences: {
      preferredDisplayMode: "expanded",
      launchAtLogin: false,
      providerVisibility: "both",
      refreshIntervalMinutes: 5,
      warningThreshold: 75,
      dangerThreshold: 90,
      notificationsEnabled: true,
      notificationLevel: "all",
      language: "en",
      timeDisplay: "utc",
      timeFormat: "24h",
      dateFormat: "iso",
      panelScale: 100,
      panelOpacity: 90,
      panelTone: "charcoal",
    },
  });
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState("");
  const [connectingClaude, setConnectingClaude] = useState(false);
  const [draftPreferences, setDraftPreferences] = useState(
    dashboardState.preferences,
  );
  const expandedPanelRef = useRef<HTMLElement | null>(null);
  const lastExpandedContentHeightRef = useRef(0);

  const surfaceMode = useMemo(() => getSurfaceMode(), []);

  async function loadState() {
    setLoading(true);
    try {
      const nextState = await window.trayUsageWidget.fetchUsageState();
      setDashboardState(nextState);
      setDraftPreferences(nextState.preferences);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadState();

    const unsubscribe = window.trayUsageWidget.onRefreshRequested(() => {
      void loadState();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const visualPreferences = settingsOpen
    ? draftPreferences
    : dashboardState.preferences;
  const language = visualPreferences.language;
  const panelOpacity = visualPreferences.panelOpacity / 100;
  const controlOpacity = clamp(panelOpacity - 0.14, 0.32, 0.82);
  const controlHoverOpacity = clamp(controlOpacity + 0.08, 0.4, 0.9);
  const controlBorderOpacity = clamp(panelOpacity - 0.52, 0.12, 0.24);
  const controlTextOpacity = clamp(panelOpacity + 0.16, 0.72, 0.98);
  const scrollbarTrackOpacity = clamp(panelOpacity - 0.18, 0.18, 0.4);
  const scrollbarThumbOpacity = clamp(panelOpacity - 0.08, 0.34, 0.72);
  const scrollbarThumbHoverOpacity = clamp(scrollbarThumbOpacity + 0.1, 0.44, 0.84);
  const visibleProviders = useMemo(
    () =>
      filterProvidersByVisibility(
        dashboardState.providers,
        visualPreferences.providerVisibility,
      ),
    [dashboardState.providers, visualPreferences.providerVisibility],
  );

  const panelStyle = {
    "--panel-opacity-high": String(panelOpacity),
    "--panel-opacity-mid": String(
      Math.max(panelOpacity - 0.04, 0.45),
    ),
    "--panel-control-alpha": String(controlOpacity),
    "--panel-control-hover-alpha": String(controlHoverOpacity),
    "--panel-control-border-alpha": String(controlBorderOpacity),
    "--panel-control-text-alpha": String(controlTextOpacity),
    "--panel-scrollbar-track-alpha": String(scrollbarTrackOpacity),
    "--panel-scrollbar-thumb-alpha": String(scrollbarThumbOpacity),
    "--panel-scrollbar-thumb-hover-alpha": String(scrollbarThumbHoverOpacity),
    ...getPanelThemeStyles(visualPreferences.panelTone),
  } as CSSProperties;

  useLayoutEffect(() => {
    if (surfaceMode !== "expanded") {
      return;
    }

    const panel = expandedPanelRef.current;
    const measuredHeight = panel
      ? Math.ceil(panel.getBoundingClientRect().height + 28)
      : 0;

    if (measuredHeight > 0) {
      lastExpandedContentHeightRef.current = measuredHeight;
    }

    const contentHeight = settingsOpen
      ? lastExpandedContentHeightRef.current
      : measuredHeight;

    void window.trayUsageWidget.syncExpandedLayout({
      contentHeight,
      settingsOpen,
    });
  }, [
    dashboardState.lastUpdatedLabel,
    loading,
    settingsOpen,
    surfaceMode,
    visibleProviders,
  ]);

  return (
    <div style={panelStyle}>
      {!(surfaceMode === "expanded" && settingsOpen) ? (
        <UsagePanel
          mode={surfaceMode}
          panelRef={surfaceMode === "expanded" ? expandedPanelRef : undefined}
          providers={visibleProviders}
          language={visualPreferences.language}
          loading={loading}
          lastUpdatedLabel={dashboardState.lastUpdatedLabel}
          onRefresh={() => void loadState()}
          onOpenSettings={() => {
            setSettingsNotice("");
            setSettingsOpen((current) => !current);
          }}
          onOpenExpanded={() => {
            void window.trayUsageWidget.openExpandedPanel();
          }}
          onOpenCompact={() => {
            void window.trayUsageWidget.openCompactPanel();
          }}
          onClose={() => {
            void window.trayUsageWidget.closePanels();
          }}
        />
      ) : null}
      {surfaceMode === "expanded" && settingsOpen ? (
        <aside className="settings-sheet">
          <div className="settings-sheet__content">
            <div className="settings-sheet__header">
              <h2>{t(language, "settings")}</h2>
              <button
                className="icon-button icon-button--icon icon-button--close"
                type="button"
                aria-label={t(language, "closeSettings")}
                onClick={() => {
                  setSettingsOpen(false);
                }}
              >
                <SettingsCloseIcon />
              </button>
            </div>
            <p className="settings-sheet__copy">
              {t(language, "codexAutoDetected")}
            </p>
            <p className="settings-sheet__hint">
              {t(language, "recommendedConnectClaude")}
            </p>
            <div className="settings-actions settings-actions--top">
              <button
                className="icon-button"
                type="button"
                disabled={connectingClaude}
                onClick={() => {
                  setSettingsNotice("");
                  setConnectingClaude(true);
                  void window.trayUsageWidget
                      .connectClaude()
                      .then((nextState) => {
                      setSettingsNotice(t(language, "claudeConnectedSuccessfully"));
                      setDashboardState(nextState);
                      setDraftPreferences(nextState.preferences);
                    })
                    .catch((error: unknown) => {
                      const message =
                        error instanceof Error
                          ? error.message
                          : t(language, "couldNotConnectClaude");
                      setSettingsNotice(message);
                    })
                    .finally(() => {
                      setConnectingClaude(false);
                    });
                }}
              >
                {connectingClaude
                  ? t(language, "waitingForClaudeLogin")
                  : t(language, "connectClaude")}
              </button>
            </div>
            <label className="settings-field">
              <span>{t(language, "language")}</span>
              <select
                value={draftPreferences.language}
                onChange={(event) => {
                  setDraftPreferences((current) => ({
                    ...current,
                    language: event.target.value as WidgetLanguage,
                  }));
                }}
              >
                <option value="en">{t(language, "english")}</option>
                <option value="zh-TW">{t(language, "traditionalChinese")}</option>
              </select>
            </label>
            <label className="settings-field">
              <span>{t(language, "preferredDisplayMode")}</span>
              <select
                value={draftPreferences.preferredDisplayMode}
                onChange={(event) => {
                  setDraftPreferences((current) => ({
                    ...current,
                    preferredDisplayMode: event.target.value as "expanded" | "compact",
                  }));
                }}
              >
                <option value="expanded">{t(language, "expandedPanel")}</option>
                <option value="compact">{t(language, "compactPanel")}</option>
              </select>
            </label>
            <label className="settings-field settings-field--checkbox">
              <span>{t(language, "launchAtLogin")}</span>
              <input
                className="settings-checkbox"
                type="checkbox"
                checked={draftPreferences.launchAtLogin}
                onChange={(event) => {
                  setDraftPreferences((current) => ({
                    ...current,
                    launchAtLogin: event.target.checked,
                  }));
                }}
              />
            </label>
            <label className="settings-field settings-field--checkbox">
              <span>{t(language, "enableNotifications")}</span>
              <input
                className="settings-checkbox"
                type="checkbox"
                checked={draftPreferences.notificationsEnabled}
                onChange={(event) => {
                  setDraftPreferences((current) => ({
                    ...current,
                    notificationsEnabled: event.target.checked,
                  }));
                }}
              />
            </label>
            <label className="settings-field">
              <span>{t(language, "notificationMode")}</span>
              <select
                value={draftPreferences.notificationLevel}
                onChange={(event) => {
                  setDraftPreferences((current) => ({
                    ...current,
                    notificationLevel: event.target.value as "all" | "danger",
                  }));
                }}
              >
                <option value="all">{t(language, "notificationAllLevels")}</option>
                <option value="danger">{t(language, "notificationDangerOnly")}</option>
              </select>
            </label>
            <label className="settings-field">
              <span>{t(language, "providerVisibility")}</span>
              <select
                value={draftPreferences.providerVisibility}
                onChange={(event) => {
                  setDraftPreferences((current) => ({
                    ...current,
                    providerVisibility: event.target.value as ProviderVisibility,
                  }));
                }}
              >
                <option value="both">{t(language, "bothProviders")}</option>
                <option value="claude">{t(language, "claudeOnly")}</option>
                <option value="codex">{t(language, "codexOnly")}</option>
              </select>
            </label>
            <label className="settings-field">
              <span>{t(language, "refreshInterval")}</span>
              <select
                value={String(draftPreferences.refreshIntervalMinutes)}
                onChange={(event) => {
                  setDraftPreferences((current) => ({
                    ...current,
                    refreshIntervalMinutes: Number(event.target.value),
                  }));
                }}
              >
                <option value="1">{t(language, "oneMinute")}</option>
                <option value="5">{t(language, "fiveMinutes")}</option>
                <option value="15">{t(language, "fifteenMinutes")}</option>
              </select>
            </label>
            <label className="settings-field">
              <span>{t(language, "warningThreshold")}</span>
              <input
                type="number"
                min="1"
                max="99"
                value={draftPreferences.warningThreshold}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  if (!Number.isFinite(nextValue)) {
                    return;
                  }
                  setDraftPreferences((current) => ({
                    ...current,
                    warningThreshold: nextValue,
                  }));
                }}
              />
            </label>
            <label className="settings-field">
              <span>{t(language, "dangerThreshold")}</span>
              <input
                type="number"
                min="2"
                max="100"
                value={draftPreferences.dangerThreshold}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  if (!Number.isFinite(nextValue)) {
                    return;
                  }
                  setDraftPreferences((current) => ({
                    ...current,
                    dangerThreshold: nextValue,
                  }));
                }}
              />
            </label>
            <label className="settings-field">
              <span>{t(language, "resetTimeTimezone")}</span>
              <select
                value={draftPreferences.timeDisplay}
                onChange={(event) => {
                  setDraftPreferences((current) => ({
                    ...current,
                    timeDisplay: event.target.value as "utc" | "local",
                  }));
                }}
              >
                <option value="utc">UTC</option>
                <option value="local">{t(language, "localTime")}</option>
              </select>
            </label>
            <label className="settings-field">
              <span>{t(language, "timeDisplayFormat")}</span>
              <select
                value={draftPreferences.timeFormat}
                onChange={(event) => {
                  setDraftPreferences((current) => ({
                    ...current,
                    timeFormat: event.target.value as "24h" | "12h",
                  }));
                }}
              >
                <option value="24h">{t(language, "twentyFourHour")}</option>
                <option value="12h">{t(language, "twelveHour")}</option>
              </select>
            </label>
            <label className="settings-field">
              <span>{t(language, "dateFormat")}</span>
              <select
                value={draftPreferences.dateFormat}
                onChange={(event) => {
                  setDraftPreferences((current) => ({
                    ...current,
                    dateFormat: event.target.value as typeof current.dateFormat,
                  }));
                }}
              >
                <option value="iso">{t(language, "dateFormatIso")}</option>
                <option value="mdy">{t(language, "dateFormatMdy")}</option>
                <option value="dmy">{t(language, "dateFormatDmy")}</option>
              </select>
            </label>
            <label className="settings-field">
              <span>{t(language, "panelScale")}: {draftPreferences.panelScale}%</span>
              <input
                type="range"
                min="0"
                max={String(PANEL_SCALE_OPTIONS.length - 1)}
                step="1"
                value={String(getPanelScaleSliderIndex(draftPreferences.panelScale))}
                onChange={(event) => {
                  setDraftPreferences((current) => ({
                    ...current,
                    panelScale: getPanelScaleFromSliderIndex(Number(event.target.value)),
                  }));
                }}
              />
            </label>
            <label className="settings-field">
              <span>{t(language, "panelTransparency")}: {draftPreferences.panelOpacity}%</span>
              <input
                type="range"
                min="70"
                max="96"
                step="2"
                value={draftPreferences.panelOpacity}
                onChange={(event) => {
                  setDraftPreferences((current) => ({
                    ...current,
                    panelOpacity: Number(event.target.value),
                  }));
                }}
              />
            </label>
            <label className="settings-field">
              <span>{t(language, "panelBackgroundColor")}</span>
              <select
                value={draftPreferences.panelTone}
                onChange={(event) => {
                  setDraftPreferences((current) => ({
                    ...current,
                    panelTone: event.target.value as PanelTone,
                  }));
                }}
              >
                {PANEL_THEME_OPTIONS.map((theme) => (
                  <option key={theme} value={theme}>
                    {t(language, theme)}
                  </option>
                ))}
              </select>
            </label>
            {settingsNotice ? (
              <p className="settings-sheet__notice">{settingsNotice}</p>
            ) : null}
          </div>
          <div className="settings-actions">
            <button
              className="icon-button"
              type="button"
              onClick={() => {
                void window.trayUsageWidget
                  .saveSettings(draftPreferences)
                  .then((nextState) => {
                    setSettingsNotice(t(draftPreferences.language, "savedClaudeAccepted"));
                    setDashboardState(nextState);
                    setDraftPreferences(nextState.preferences);
                    setSettingsOpen(false);
                  })
                  .catch((error: unknown) => {
                    const message =
                      error instanceof Error
                        ? error.message
                        : t(language, "couldNotSaveClaudeSettings");
                    setSettingsNotice(message);
                  });
              }}
            >
              {t(language, "savePreferences")}
            </button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

export default App;

function SettingsCloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="toolbar-icon toolbar-icon--close">
      <path
        d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
