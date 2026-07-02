import type { WidgetLanguage } from "./i18n";
import type { PanelScalePercent } from "./panel-scale";
import type { PanelTone } from "./panel-themes";
import type { NormalizedProviderUsage } from "./usage";

export interface ProviderVisibility {
  claude: boolean;
  codex: boolean;
  antigravity: boolean;
}
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
  timeDisplay: "utc" | "tst" | "local";
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

export interface SystemMetric {
  id: "cpu" | "gpu" | "ram" | "net";
  label: string;
  percent: number | null;
  readout: string;
  available: boolean;
}

export interface SystemState {
  metrics: SystemMetric[];
  lastUpdated: string;
}
