import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  Tooltip,
  type ChartConfiguration,
} from "chart.js";

import { t, type WidgetLanguage } from "../shared/i18n";
import type { NormalizedProviderUsage, ProviderId } from "../shared/usage";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const WEATHER_COST_STOPS = [
  { costUsd: 0, rgb: [96, 190, 255] },
  { costUsd: 20, rgb: [139, 211, 255] },
  { costUsd: 35, rgb: [255, 224, 118] },
  { costUsd: 50, rgb: [255, 184, 60] },
  { costUsd: 80, rgb: [255, 128, 79] },
  { costUsd: 120, rgb: [229, 69, 86] },
] as const;

export interface UsagePanelProps {
  mode: "expanded" | "compact";
  panelRef?: Ref<HTMLElement>;
  providers: NormalizedProviderUsage[];
  language: WidgetLanguage;
  loading: boolean;
  lastUpdatedLabel: string;
  onRefresh?: () => void;
  onOpenSettings?: () => void;
  onOpenExpanded?: () => void;
  onOpenCompact?: () => void;
  onClose?: () => void;
}

export function UsagePanel({
  mode,
  panelRef,
  providers,
  language,
  loading,
  lastUpdatedLabel,
  onRefresh,
  onOpenSettings,
  onOpenExpanded,
  onOpenCompact,
  onClose,
}: UsagePanelProps) {
  const [selectedHistoryProviderId, setSelectedHistoryProviderId] =
    useState<ProviderId>("codex");
  const historyProviders = useMemo(
    () =>
      providers.filter((provider) =>
        ["claude", "codex", "agy"].includes(provider.provider),
      ),
    [providers],
  );
  const hasHistoryUsageProvider = historyProviders.some(
    (provider) => provider.localUsage,
  );

  useEffect(() => {
    if (historyProviders.length === 0) {
      return;
    }

    if (
      historyProviders.some(
        (provider) => provider.provider === selectedHistoryProviderId,
      )
    ) {
      return;
    }

    setSelectedHistoryProviderId(
      historyProviders.find((provider) => provider.localUsage)?.provider ??
        historyProviders[0].provider,
    );
  }, [historyProviders, selectedHistoryProviderId]);

  if (mode === "compact") {
    const colClass =
      providers.length >= 3
        ? " compact-widget__columns--triple"
        : providers.length === 1
          ? " compact-widget__columns--single"
          : "";

    return (
      <main className="compact-shell">
        <section className="compact-widget">
          <div className="compact-widget__toolbar drag-region">
            <div className="compact-widget__identity">
              <span className="compact-widget__brand">
                <span>QuotaGem</span>
              </span>
              <span className="compact-widget__meta" aria-live="polite">
                {loading ? t(language, "refreshing") : lastUpdatedLabel}
              </span>
            </div>
            <div className="compact-widget__toolbar-actions no-drag">
              <button
                className="icon-button icon-button--icon no-drag"
                type="button"
                aria-label={t(language, "openExpandedUsagePanel")}
                onClick={() => {
                  onOpenExpanded?.();
                }}
                title={t(language, "openExpandedUsagePanel")}
              >
                <SwitchExpandedIcon />
              </button>
              <button
                className="icon-button icon-button--icon no-drag"
                type="button"
                aria-label={t(language, "refreshUsage")}
                onClick={() => {
                  onRefresh?.();
                }}
                title={t(language, "refreshUsage")}
              >
                <RefreshIcon />
              </button>
              <button
                className="icon-button icon-button--icon no-drag"
                type="button"
                aria-label={t(language, "openSettings")}
                onClick={() => {
                  onOpenSettings?.();
                }}
                title={t(language, "openSettings")}
              >
                <SettingsIcon />
              </button>
              <button
                className="icon-button icon-button--icon icon-button--close no-drag"
                type="button"
                aria-label={t(language, "hidePanel")}
                onClick={() => {
                  onClose?.();
                }}
                title={t(language, "hidePanel")}
              >
                <HideIcon />
              </button>
            </div>
          </div>
          {hasHistoryUsageProvider ? (
            <UsageHistoryChart
              language={language}
              providers={historyProviders}
              selectedProviderId={selectedHistoryProviderId}
              onSelectedProviderChange={setSelectedHistoryProviderId}
            />
          ) : null}
          <div className="compact-widget__content no-drag">
            <div className={`compact-widget__columns${colClass}`}>
              {providers.map((provider) => (
                <article
                  key={provider.provider}
                  className={`compact-provider compact-provider--${provider.provider} compact-provider--${provider.health}`}
                >
                  <div className="compact-provider__header">
                    <span className="compact-provider__title">
                      <ProviderIcon provider={provider.provider} />
                      <span>{provider.displayName}</span>
                    </span>
                    <span className="compact-provider__health">
                      {provider.health === "available"
                        ? t(language, "live")
                        : t(language, "unavailable")}
                    </span>
                  </div>
                  <CompactMetric
                    language={language}
                    label={provider.session.label}
                    percent={provider.session.percent}
                    displayPercent={provider.session.displayPercent}
                    percentLabel={provider.session.percentLabel}
                    barMode={provider.session.barMode}
                    resetLabel={provider.session.resetLabel}
                  />
                  <CompactMetric
                    language={language}
                    label={provider.weekly.label}
                    percent={provider.weekly.percent}
                    displayPercent={provider.weekly.displayPercent}
                    percentLabel={provider.weekly.percentLabel}
                    barMode={provider.weekly.barMode}
                    resetLabel={provider.weekly.resetLabel}
                  />
                  {provider.monthly && (
                    <CompactMetric
                      language={language}
                      label={provider.monthly.label}
                      percent={provider.monthly.percent}
                      displayPercent={provider.monthly.displayPercent}
                      percentLabel={provider.monthly.percentLabel}
                      barMode={provider.monthly.barMode}
                      resetLabel={provider.monthly.resetLabel}
                    />
                  )}
                  {provider.thirdPartySession && (
                    <CompactMetric
                      language={language}
                      label={provider.thirdPartySession.label}
                      percent={provider.thirdPartySession.percent}
                      displayPercent={provider.thirdPartySession.displayPercent}
                      percentLabel={provider.thirdPartySession.percentLabel}
                      barMode={provider.thirdPartySession.barMode}
                      resetLabel={provider.thirdPartySession.resetLabel}
                    />
                  )}
                  {provider.thirdPartyWeekly && (
                    <CompactMetric
                      language={language}
                      label={provider.thirdPartyWeekly.label}
                      percent={provider.thirdPartyWeekly.percent}
                      displayPercent={provider.thirdPartyWeekly.displayPercent}
                      percentLabel={provider.thirdPartyWeekly.percentLabel}
                      barMode={provider.thirdPartyWeekly.barMode}
                      resetLabel={provider.thirdPartyWeekly.resetLabel}
                    />
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section ref={panelRef} className="glass-panel expanded-panel">
        <header className="panel-header drag-region">
          <div className="panel-header__identity">
            <span className="panel-header__brand">
              <UsageMark className="panel-header__mark" />
              <span>QuotaGem</span>
            </span>
            <span className="header-meta" aria-live="polite">
              {loading ? t(language, "refreshing") : lastUpdatedLabel}
            </span>
          </div>
          <div className="panel-header__actions no-drag">
            <button
              className="icon-button icon-button--icon no-drag"
              type="button"
              aria-label={t(language, "openCompactUsagePanel")}
              onClick={() => {
                onOpenCompact?.();
              }}
              title={t(language, "openCompactUsagePanel")}
            >
              <SwitchCompactIcon />
            </button>
            <button
              className="icon-button icon-button--icon no-drag"
              type="button"
              aria-label={t(language, "refreshUsage")}
              onClick={() => {
                onRefresh?.();
              }}
              title={t(language, "refreshUsage")}
            >
              <RefreshIcon />
            </button>
            <button
              className="icon-button icon-button--icon no-drag"
              type="button"
              aria-label={t(language, "openSettings")}
              onClick={() => {
                onOpenSettings?.();
              }}
              title={t(language, "openSettings")}
            >
              <SettingsIcon />
            </button>
            <button
              className="icon-button icon-button--icon icon-button--close no-drag"
              type="button"
              aria-label={t(language, "hidePanel")}
              onClick={() => {
                onClose?.();
              }}
              title={t(language, "hidePanel")}
            >
              <HideIcon />
            </button>
          </div>
        </header>

        <section className="provider-grid">
          {providers.map((provider) => (
            <article
              key={provider.provider}
              className={`provider-card provider-card--${provider.provider} provider-card--${provider.health}`}
            >
              <div className="provider-card__header">
                <h2 className="provider-card__title">
                  <span className="provider-card__icon-shell">
                    <ProviderIcon provider={provider.provider} />
                  </span>
                  <span>{provider.displayName}</span>
                </h2>
                <span
                  className={`provider-pill provider-pill--${provider.health}`}
                >
                  <span className="provider-pill__dot" aria-hidden="true" />
                  {provider.health === "available"
                    ? t(language, "live")
                    : t(language, "unavailable")}
                </span>
              </div>

              <ProviderMetric
                language={language}
                label={provider.session.label}
                percent={provider.session.percent}
                displayPercent={provider.session.displayPercent}
                percentLabel={provider.session.percentLabel}
                barMode={provider.session.barMode}
                resetLabel={provider.session.resetLabel}
                level={provider.session.level}
              />
              <ProviderMetric
                language={language}
                label={provider.weekly.label}
                percent={provider.weekly.percent}
                displayPercent={provider.weekly.displayPercent}
                percentLabel={provider.weekly.percentLabel}
                barMode={provider.weekly.barMode}
                resetLabel={provider.weekly.resetLabel}
                level={provider.weekly.level}
              />
              {provider.monthly && (
                <ProviderMetric
                  language={language}
                  label={provider.monthly.label}
                  percent={provider.monthly.percent}
                  displayPercent={provider.monthly.displayPercent}
                  percentLabel={provider.monthly.percentLabel}
                  barMode={provider.monthly.barMode}
                  resetLabel={provider.monthly.resetLabel}
                  level={provider.monthly.level}
                />
              )}
              {provider.thirdPartySession && (
                <ProviderMetric
                  language={language}
                  label={provider.thirdPartySession.label}
                  percent={provider.thirdPartySession.percent}
                  displayPercent={provider.thirdPartySession.displayPercent}
                  percentLabel={provider.thirdPartySession.percentLabel}
                  barMode={provider.thirdPartySession.barMode}
                  resetLabel={provider.thirdPartySession.resetLabel}
                  level={provider.thirdPartySession.level}
                />
              )}
              {provider.thirdPartyWeekly && (
                <ProviderMetric
                  language={language}
                  label={provider.thirdPartyWeekly.label}
                  percent={provider.thirdPartyWeekly.percent}
                  displayPercent={provider.thirdPartyWeekly.displayPercent}
                  percentLabel={provider.thirdPartyWeekly.percentLabel}
                  barMode={provider.thirdPartyWeekly.barMode}
                  resetLabel={provider.thirdPartyWeekly.resetLabel}
                  level={provider.thirdPartyWeekly.level}
                />
              )}
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}

function UsageHistoryChart({
  language,
  providers,
  selectedProviderId,
  onSelectedProviderChange,
}: {
  language: WidgetLanguage;
  providers: NormalizedProviderUsage[];
  selectedProviderId: ProviderId;
  onSelectedProviderChange: (provider: ProviderId) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectedProvider =
    providers.find((provider) => provider.provider === selectedProviderId) ??
    providers.find((provider) => provider.localUsage) ??
    providers[0];
  const localUsage = selectedProvider?.localUsage;
  const chartDays = useMemo(
    () => localUsage?.recentDailyUsage ?? [],
    [localUsage?.recentDailyUsage],
  );

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || chartDays.length === 0) {
      return;
    }

    let context: CanvasRenderingContext2D | null = null;

    try {
      context = canvas.getContext("2d");
    } catch {
      return;
    }

    if (!context) {
      return;
    }

    const canvasStyles = getComputedStyle(canvas);
    const panelTextRgb =
      canvasStyles.getPropertyValue("--panel-text-rgb").trim() || "245, 247, 251";
    const panelMutedRgb =
      canvasStyles.getPropertyValue("--panel-muted-rgb").trim() || panelTextRgb;
    const panelCardRgb =
      canvasStyles.getPropertyValue("--panel-card-rgb").trim() || "10, 14, 22";
    const panelBorderRgb =
      canvasStyles.getPropertyValue("--panel-border-rgb").trim() || panelMutedRgb;

    const config: ChartConfiguration<"bar", number[], string> = {
      type: "bar",
      data: {
        labels: chartDays.map((day) => day.dateLabel),
        datasets: [
          {
            data: chartDays.map((day) => day.costUsd),
            backgroundColor: chartDays.map((day) =>
              getWeatherUsageColor(day.costUsd, 0.9),
            ),
            borderColor: chartDays.map((day) =>
              getWeatherUsageColor(day.costUsd, 1),
            ),
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false,
            hoverBackgroundColor: chartDays.map((day) =>
              getWeatherUsageColor(day.costUsd, 0.98),
            ),
            maxBarThickness: 22,
          },
        ],
      },
      options: {
        animation: false,
        maintainAspectRatio: false,
        responsive: true,
        layout: {
          padding: {
            top: 4,
            right: 8,
            bottom: 0,
            left: 8,
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: `rgba(${panelCardRgb}, 0.96)`,
            bodyColor: `rgba(${panelTextRgb}, 0.92)`,
            borderColor: `rgba(${panelBorderRgb}, 0.24)`,
            borderWidth: 1,
            displayColors: false,
            padding: 10,
            titleColor: `rgba(${panelTextRgb}, 0.98)`,
            callbacks: {
              label(context) {
                const day = chartDays[context.dataIndex];

                return day ? `Tokens: ${day.tokensLabel}` : "";
              },
              afterLabel(context) {
                const day = chartDays[context.dataIndex];

                return day ? `Cost: ${day.costLabel}` : "";
              },
            },
          },
        },
        scales: {
          x: {
            border: {
              display: false,
            },
            grid: {
              display: false,
            },
            ticks: {
              color: `rgba(${panelMutedRgb}, 0.82)`,
              font: {
                size: 11,
                weight: 600,
              },
              maxRotation: 0,
            },
          },
          y: {
            beginAtZero: true,
            border: {
              display: false,
            },
            display: false,
            grid: {
              display: false,
            },
          },
        },
      },
    };

    const chart = new Chart(context, config);

    return () => {
      chart.destroy();
    };
  }, [chartDays]);

  if (!selectedProvider) {
    return null;
  }

  return (
    <section className="usage-history no-drag">
      <div className="usage-history__header">
        <div className="usage-history__summary">
          {localUsage ? (
            <>
              <UsageHistorySummaryItem
                label={localUsage.todayUsageLabel}
                modelBreakdown={localUsage.modelBreakdowns.today}
                language={language}
              />
              <UsageHistorySummaryItem
                label={localUsage.weeklyUsageLabel}
                modelBreakdown={localUsage.modelBreakdowns.weekly}
                language={language}
              />
              <UsageHistorySummaryItem
                label={localUsage.historyUsageLabel}
                modelBreakdown={localUsage.modelBreakdowns.history}
                language={language}
              />
            </>
          ) : (
            <span className="usage-history__summary-item">
              {getHistoryProviderLabel(selectedProvider)}
            </span>
          )}
        </div>
        <div className="usage-history__segmented" role="group">
          {providers.map((provider) => (
            <button
              key={provider.provider}
              className={`usage-history__segment${provider.provider === selectedProvider.provider ? " usage-history__segment--active" : ""}`}
              type="button"
              aria-pressed={provider.provider === selectedProvider.provider}
              onClick={() => {
                onSelectedProviderChange(provider.provider);
              }}
            >
              {getHistoryProviderLabel(provider)}
            </button>
          ))}
        </div>
      </div>
      {localUsage ? (
        <div
          className="usage-history__chart"
          role="img"
          aria-label={localUsage.todayUsageLabel}
        >
          <canvas className="usage-history__canvas" ref={canvasRef} />
        </div>
      ) : (
        <div className="usage-history__empty">
          {t(language, "usageHistoryUnavailable")}
        </div>
      )}
    </section>
  );
}

function UsageHistorySummaryItem({
  label,
  modelBreakdown,
  language,
}: {
  label: string;
  modelBreakdown: NonNullable<NormalizedProviderUsage["localUsage"]>["modelBreakdown"];
  language: WidgetLanguage;
}) {
  const hasBreakdown = modelBreakdown.length > 0;

  return (
    <span
      className={`usage-history__summary-item${hasBreakdown ? " usage-history__summary-item--interactive" : ""}`}
      tabIndex={hasBreakdown ? 0 : undefined}
    >
      <span className="usage-history__summary-label">{label}</span>
      {hasBreakdown ? (
        <span
          className="usage-history__model-popover"
          role="tooltip"
          aria-label={t(language, "modelUsageBreakdown")}
        >
          <span className="usage-history__model-popover-title">
            {t(language, "modelUsageBreakdown")}
          </span>
          <span className="usage-history__model-popover-list">
            {modelBreakdown.map((model) => (
              <span
                key={model.model}
                className="usage-history__model-popover-row"
                title={model.detailLabel}
              >
                <span className="usage-history__model-popover-name">
                  {model.model}
                </span>
                <span className="usage-history__model-popover-meta">
                  {model.tokensLabel} · {model.percentLabel}
                </span>
              </span>
            ))}
          </span>
        </span>
      ) : null}
    </span>
  );
}

function getHistoryProviderLabel(provider: NormalizedProviderUsage) {
  return provider.provider === "agy" ? "Antigravity" : provider.displayName;
}

function getWeatherUsageColor(costUsd: number, alpha: number) {
  const safeCost = Number.isFinite(costUsd) ? Math.max(costUsd, 0) : 0;
  const firstStop = WEATHER_COST_STOPS[0];
  const lastStop = WEATHER_COST_STOPS[WEATHER_COST_STOPS.length - 1];

  if (safeCost <= firstStop.costUsd) {
    return formatRgba(firstStop.rgb, alpha);
  }

  if (safeCost >= lastStop.costUsd) {
    return formatRgba(lastStop.rgb, alpha);
  }

  const nextStopIndex = WEATHER_COST_STOPS.findIndex(
    (stop) => stop.costUsd >= safeCost,
  );
  const nextStop = WEATHER_COST_STOPS[nextStopIndex];
  const previousStop = WEATHER_COST_STOPS[nextStopIndex - 1] ?? firstStop;
  const range = nextStop.costUsd - previousStop.costUsd || 1;
  const ratio = (safeCost - previousStop.costUsd) / range;
  const rgb = previousStop.rgb.map((channel, index) =>
    Math.round(channel + (nextStop.rgb[index] - channel) * ratio),
  ) as [number, number, number];

  return formatRgba(rgb, alpha);
}

function formatRgba(rgb: readonly [number, number, number], alpha: number) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function ProviderMetric({
  language,
  label,
  percent,
  displayPercent,
  percentLabel,
  barMode,
  resetLabel,
  level,
}: {
  language: WidgetLanguage;
  label: string;
  percent: number;
  displayPercent: number;
  percentLabel: string;
  barMode: "used" | "remaining";
  resetLabel: string;
  level: "normal" | "warning" | "danger";
}) {
  return (
    <div className="metric-row">
      <div className="metric-row__copy">
        <span className="metric-row__label">{label}</span>
        <strong className="metric-row__value">{percentLabel}</strong>
      </div>
      <div
        className={`metric-row__bar${barMode === "remaining" ? " metric-row__bar--remaining" : ""}`}
        role="progressbar"
        aria-label={`${label}: ${percentLabel}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(displayPercent, 100))}
      >
        <div
          className={`metric-row__fill metric-row__fill--${level}${barMode === "remaining" ? " metric-row__fill--remaining" : ""}`}
          style={{ width: `${Math.min(displayPercent, 100)}%` }}
        />
      </div>
      <div className="metric-row__footer">
        <span>{t(language, "resets")}</span>
        <span>{resetLabel}</span>
      </div>
    </div>
  );
}

function CompactMetric({
  language,
  label,
  percent,
  displayPercent,
  percentLabel,
  barMode,
  resetLabel,
}: {
  language: WidgetLanguage;
  label: string;
  percent: number;
  displayPercent: number;
  percentLabel: string;
  barMode: "used" | "remaining";
  resetLabel: string;
}) {
  const level = getUsageLevel(percent);
  return (
    <div className="compact-metric">
      <div className="compact-metric__header">
        <span className="compact-metric__label">{label}</span>
        <strong className="compact-metric__value">{percentLabel}</strong>
      </div>
      <div
        className={`compact-metric__bar${barMode === "remaining" ? " compact-metric__bar--remaining" : ""}`}
        role="progressbar"
        aria-label={`${label}: ${percentLabel}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(displayPercent, 100))}
      >
        <div
          className={`compact-metric__fill compact-metric__fill--${level}${barMode === "remaining" ? " compact-metric__fill--remaining" : ""}`}
          style={{ width: `${Math.min(displayPercent, 100)}%` }}
        />
      </div>
      <div className="compact-metric__footer">
        <span>{t(language, "resets")}</span>
        <span>{resetLabel}</span>
      </div>
    </div>
  );
}

function getUsageLevel(percent: number): "normal" | "warning" | "danger" {
  if (percent >= 90) {
    return "danger";
  }

  if (percent >= 75) {
    return "warning";
  }

  return "normal";
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="toolbar-icon">
      <path
        d="M12.8 6A5 5 0 1 0 13 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M10.8 3.1h2.8v2.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SwitchExpandedIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="toolbar-icon">
      <rect
        x="2.2"
        y="3"
        width="11.6"
        height="8.2"
        rx="1.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M7 12.8h2"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SwitchCompactIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="toolbar-icon">
      <rect
        x="2.4"
        y="4.2"
        width="11.2"
        height="6"
        rx="1.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <rect x="4.2" y="6" width="3.8" height="2.3" rx="0.8" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

function HideIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="toolbar-icon toolbar-icon--close">
      <path
        d="M4 8.5h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="toolbar-icon">
      <path
        d="M3 4h10M3 8h10M3 12h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <circle cx="6" cy="4" r="1.35" fill="currentColor" />
      <circle cx="10.2" cy="8" r="1.35" fill="currentColor" />
      <circle cx="7.4" cy="12" r="1.35" fill="currentColor" />
    </svg>
  );
}

function UsageMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <circle cx="23" cy="31" r="7.2" fill="currentColor" />
      <circle cx="34" cy="20" r="4.1" fill="currentColor" />
      <circle cx="37" cy="40" r="5.4" fill="currentColor" />
    </svg>
  );
}

function ProviderIcon({ provider }: { provider: "claude" | "codex" | "agy" }) {
  if (provider === "agy") {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="provider-icon provider-icon--agy"
      >
        <path
          d="M12 2C12.5 6.8 17.2 11.5 22 12C17.2 12.5 12.5 17.2 12 22C11.5 17.2 6.8 12.5 2 12C6.8 11.5 11.5 6.8 12 2Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (provider === "claude") {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="provider-icon provider-icon--claude"
      >
        <path
          d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"
          fill="currentColor"
          fillRule="nonzero"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="provider-icon provider-icon--codex"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z"
        clipRule="evenodd"
      />
    </svg>
  );
}
