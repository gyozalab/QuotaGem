import type { UsageDashboardState } from "../shared/dashboard";
import { t } from "../shared/i18n";
import type {
  NormalizedProviderUsage,
  NormalizedProviderUsageGroup,
} from "../shared/usage";

type UsageAlertLevel = "none" | "warning" | "danger";
type UsageMetric = "session" | "weekly";

export interface UsageAlertNotification {
  id: string;
  title: string;
  body: string;
  level: Exclude<UsageAlertLevel, "none">;
}

// 一個告警範圍：可能是整個 provider（無群組），或某個模型群組（antigravity）。
interface AlertScope {
  session: NormalizedProviderUsageGroup["session"];
  weekly: NormalizedProviderUsageGroup["weekly"];
  groupLabel: string | null;
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

        // group-aware：有群組就逐群組逐軌判定，否則沿用 provider 頂層兩軌。
        const scopes: AlertScope[] =
          provider.groups && provider.groups.length > 0
            ? provider.groups.map((group) => ({
                session: group.session,
                weekly: group.weekly,
                groupLabel: group.label,
              }))
            : [
                {
                  session: provider.session,
                  weekly: provider.weekly,
                  groupLabel: null,
                },
              ];

        for (const scope of scopes) {
          for (const metric of ["session", "weekly"] as const) {
            const nextLevel = toAlertLevel(scope[metric].level);
            const alertId = scope.groupLabel
              ? `${provider.provider}:${scope.groupLabel}:${metric}`
              : `${provider.provider}:${metric}`;
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
                  scope,
                  metric,
                  alertId,
                  nextLevel,
                ),
              );
            }

            seenLevels.set(alertId, nextLevel);
          }
        }
      }

      return alerts;
    },
  };
}

function buildUsageAlertNotification(
  language: UsageDashboardState["preferences"]["language"],
  provider: NormalizedProviderUsage,
  scope: AlertScope,
  metric: UsageMetric,
  alertId: string,
  level: Exclude<UsageAlertLevel, "none">,
): UsageAlertNotification {
  return {
    id: alertId,
    title: t(language, "trayUsageWidget"),
    body: t(language, "usageAlertBody", {
      provider: scope.groupLabel
        ? `${provider.displayName} · ${scope.groupLabel}`
        : provider.displayName,
      metric: scope[metric].label,
      percent: Math.round(scope[metric].percent),
    }),
    level,
  };
}

function toAlertLevel(
  level: NormalizedProviderUsage["session"]["level"],
): UsageAlertLevel {
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
