import type { UsageDashboardState } from "../shared/dashboard";
import { t } from "../shared/i18n";
import type { NormalizedProviderUsage } from "../shared/usage";

type UsageAlertLevel = "none" | "warning" | "danger";
type UsageMetric = "session" | "weekly";

export interface UsageAlertNotification {
  id: string;
  title: string;
  body: string;
  level: Exclude<UsageAlertLevel, "none">;
}

export function createUsageAlertTracker() {
  const seenLevels = new Map<string, UsageAlertLevel>();

  return {
    consume(state: UsageDashboardState): UsageAlertNotification[] {
      const alerts: UsageAlertNotification[] = [];

      for (const provider of state.providers) {
        if (provider.health === "unavailable") {
          continue;
        }

        for (const metric of ["session", "weekly"] as const) {
          const nextLevel = toAlertLevel(provider[metric].level);
          const alertId = `${provider.provider}:${metric}`;
          const previousLevel = seenLevels.get(alertId) ?? "none";

          if (
            state.preferences.notificationsEnabled &&
            nextLevel !== "none" &&
            shouldNotifyForLevel(state.preferences.notificationLevel, nextLevel) &&
            getAlertRank(nextLevel) > getAlertRank(previousLevel)
          ) {
            alerts.push(
              buildUsageAlertNotification(
                state.preferences.language,
                provider,
                metric,
                nextLevel,
              ),
            );
          }

          seenLevels.set(alertId, nextLevel);
        }
      }

      return alerts;
    },
  };
}

function buildUsageAlertNotification(
  language: UsageDashboardState["preferences"]["language"],
  provider: NormalizedProviderUsage,
  metric: UsageMetric,
  level: Exclude<UsageAlertLevel, "none">,
): UsageAlertNotification {
  return {
    id: `${provider.provider}:${metric}`,
    title: t(language, "trayUsageWidget"),
    body: t(language, "usageAlertBody", {
      provider: provider.displayName,
      metric: provider[metric].label,
      percent: Math.round(provider[metric].percent),
    }),
    level,
  };
}

function toAlertLevel(level: NormalizedProviderUsage["session"]["level"]): UsageAlertLevel {
  if (level === "danger") {
    return "danger";
  }

  if (level === "warning") {
    return "warning";
  }

  return "none";
}

function getAlertRank(level: UsageAlertLevel): number {
  if (level === "danger") {
    return 2;
  }

  if (level === "warning") {
    return 1;
  }

  return 0;
}

function shouldNotifyForLevel(
  notificationLevel: UsageDashboardState["preferences"]["notificationLevel"],
  level: Exclude<UsageAlertLevel, "none">,
): boolean {
  if (notificationLevel === "danger") {
    return level === "danger";
  }

  return true;
}
