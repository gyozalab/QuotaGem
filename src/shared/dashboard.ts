import type { WidgetLanguage } from "./i18n";
import type { PanelScalePercent } from "./panel-scale";
import type { PanelTone } from "./panel-themes";
import type { NormalizedProviderUsage } from "./usage";

export type ProviderVisibility = "both" | "claude" | "codex";
export type DateFormatPreference = "iso" | "mdy" | "dmy";

export interface WidgetPreferences {
  preferredDisplayMode: "expanded" | "compact";
  launchAtLogin: boolean;
  providerVisibility: ProviderVisibility;
  refreshIntervalMinutes: number;
  warningThreshold: number;
  dangerThreshold: number;
  notificationsEnabled: boolean;
  notificationLevel: "all" | "danger";
  language: WidgetLanguage;
  timeDisplay: "utc" | "local";
  timeFormat: "24h" | "12h";
  dateFormat: DateFormatPreference;
  panelScale: PanelScalePercent;
  panelOpacity: number;
  panelTone: PanelTone;
}

export interface UsageDashboardState {
  providers: NormalizedProviderUsage[];
  lastUpdatedLabel: string;
  preferences: WidgetPreferences;
}
