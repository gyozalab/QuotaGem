//! 配額閾值警示（移植自 1.0 `src/main/usage-alerts.ts`）
//!
//! - Task 6.1：超 warning/danger 閾值 → 發 Windows 通知（`tauri-plugin-notification`）。
//! - Task 6.2：通知等級過濾——"all" 通知 warning+danger，"danger" 只通知 danger。
//! - Task 6.3：跨刷新去重——rank-based，同 key 只在等級升高時通知；降回後再次跨越可再通知。
//!   priming：首次 consume 填充 `seen_levels` 但不發通知（對應 1.0 `usageAlertsPrimed`，
//!   避免啟動時對既有高用量灌一波通知）。`health == Unavailable` 的 provider 整個跳過。

use std::collections::HashMap;

use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;

use crate::models::{ProviderHealth, ProviderId, UsageSnapshot, WidgetPreferences};

// ── Alert level（對應 1.0 `UsageAlertLevel`）──

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AlertLevel {
    None,
    Warning,
    Danger,
}

fn get_alert_level(percent: f64, warning_threshold: u32, danger_threshold: u32) -> AlertLevel {
    if percent >= f64::from(danger_threshold) {
        AlertLevel::Danger
    } else if percent >= f64::from(warning_threshold) {
        AlertLevel::Warning
    } else {
        AlertLevel::None
    }
}

/// 等級排名，供跨刷新去重比較（對應 1.0 `getAlertRank`）。
fn get_alert_rank(level: AlertLevel) -> u8 {
    match level {
        AlertLevel::None => 0,
        AlertLevel::Warning => 1,
        AlertLevel::Danger => 2,
    }
}

/// 通知等級過濾（對應 1.0 `shouldNotifyForLevel`）：
/// "danger" 只放行 Danger；其餘（"all"）放行 Warning + Danger。
fn should_notify_for_level(notification_level: &str, level: AlertLevel) -> bool {
    if notification_level == "danger" {
        level == AlertLevel::Danger
    } else {
        true
    }
}

fn provider_id_str(id: &ProviderId) -> &'static str {
    match id {
        ProviderId::Claude => "claude",
        ProviderId::Codex => "codex",
        ProviderId::Antigravity => "antigravity",
    }
}

// ── Alert notification ──

#[derive(Debug, Clone)]
pub struct AlertNotification {
    pub title: String,
    pub body: String,
}

// ── Alert scope（對應 1.0 `AlertScope`）──

struct AlertScope {
    session_percent: f64,
    weekly_percent: f64,
    group_label: Option<String>,
}

/// 把 snapshot 攤平成一組 scope：有群組就逐群組，否則用 provider 頂層數值。
/// 對應 1.0 group-aware 邏輯。
fn build_scopes(snapshot: &UsageSnapshot) -> Vec<AlertScope> {
    if let Some(ref groups) = snapshot.groups {
        if !groups.is_empty() {
            return groups
                .iter()
                .map(|g| AlertScope {
                    session_percent: g.session_percent.unwrap_or(0.0),
                    weekly_percent: g.weekly_percent.unwrap_or(0.0),
                    group_label: Some(g.label.clone()),
                })
                .collect();
        }
    }

    vec![AlertScope {
        session_percent: snapshot.session_percent,
        weekly_percent: snapshot.weekly_percent,
        group_label: None,
    }]
}

/// 組裝單一警示通知的標題與內文。
fn build_alert(
    display_name: &str,
    scope: &AlertScope,
    metric: &str,
    percent: f64,
    level: AlertLevel,
) -> AlertNotification {
    let provider_label = match &scope.group_label {
        Some(label) => format!("{display_name} · {label}"),
        None => display_name.to_string(),
    };
    let metric_label = if metric == "session" { "Session" } else { "Weekly" };
    let emoji = if level == AlertLevel::Danger { "⛔" } else { "⚠️" };

    AlertNotification {
        title: "QuotaGem".to_string(),
        body: format!(
            "{emoji} {provider_label} — {metric_label} {percent}%",
            percent = percent.round() as i64,
        ),
    }
}

// ── Alert tracker（對應 1.0 `createUsageAlertTracker`）──

pub struct AlertTracker {
    seen_levels: HashMap<String, AlertLevel>,
    primed: bool,
}

impl AlertTracker {
    pub fn new() -> Self {
        Self {
            seen_levels: HashMap::new(),
            primed: false,
        }
    }

    /// 消費快照，回傳需發送的通知清單。
    ///
    /// - 6.1：超過 warning/danger 閾值的 session/weekly 軌道發通知。
    /// - 6.2：`notification_level` 過濾（"all" / "danger"）。
    /// - 6.3：rank-based 去重，只在等級升高時通知；降回 None 後再升又可通知。
    ///   首次 consume 為 priming：填充 `seen_levels` 但回傳空清單。
    /// `health == Unavailable` 的 provider 整個跳過（不更新 `seen_levels`，
    /// 避免暫時性失敗歸零後誤觸）。
    pub fn consume(
        &mut self,
        snapshots: &[UsageSnapshot],
        warning_threshold: u32,
        danger_threshold: u32,
        notifications_enabled: bool,
        notification_level: &str,
    ) -> Vec<AlertNotification> {
        let mut alerts = Vec::new();

        for snapshot in snapshots {
            if snapshot.health.as_ref() == Some(&ProviderHealth::Unavailable) {
                continue;
            }

            let provider_str = provider_id_str(&snapshot.provider);
            let display_name = &snapshot.display_name;

            for scope in &build_scopes(snapshot) {
                for (metric, percent) in [
                    ("session", scope.session_percent),
                    ("weekly", scope.weekly_percent),
                ] {
                    let alert_id = match &scope.group_label {
                        Some(label) => format!("{provider_str}:{label}:{metric}"),
                        None => format!("{provider_str}:{metric}"),
                    };

                    let next_level =
                        get_alert_level(percent, warning_threshold, danger_threshold);
                    let previous_level = self
                        .seen_levels
                        .get(&alert_id)
                        .copied()
                        .unwrap_or(AlertLevel::None);

                    if notifications_enabled
                        && next_level != AlertLevel::None
                        && should_notify_for_level(notification_level, next_level)
                        && get_alert_rank(next_level) > get_alert_rank(previous_level)
                    {
                        alerts.push(build_alert(display_name, scope, metric, percent, next_level));
                    }

                    // 無論是否通知都更新 seen_levels（rank 去重的記憶）
                    self.seen_levels.insert(alert_id, next_level);
                }
            }
        }

        // priming：首次 consume 填充 seen_levels 但不發通知
        if !self.primed {
            self.primed = true;
            return Vec::new();
        }

        alerts
    }
}

/// 處理快照閾值警示並發送 OS 通知。
///
/// 從 app state 取 `AlertTracker`，呼叫 `consume()`，
/// 對每個 alert 用 `tauri-plugin-notification` 發送 Windows 通知。
pub fn process_alerts(app: &AppHandle, snapshots: &[UsageSnapshot], prefs: &WidgetPreferences) {
    let tracker_state = app.state::<std::sync::Mutex<AlertTracker>>();
    let mut tracker = match tracker_state.lock() {
        Ok(t) => t,
        Err(_) => return,
    };

    let alerts = tracker.consume(
        snapshots,
        prefs.warning_threshold,
        prefs.danger_threshold,
        prefs.notifications_enabled,
        &prefs.notification_level,
    );

    for alert in alerts {
        let _ = app
            .notification()
            .builder()
            .title(&alert.title)
            .body(&alert.body)
            .show();
    }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{ProviderHealth, ProviderId, ProviderUsageGroup, UsageSnapshot};

    fn make_snapshot(
        provider: ProviderId,
        name: &str,
        session: f64,
        weekly: f64,
    ) -> UsageSnapshot {
        UsageSnapshot {
            provider,
            display_name: name.to_string(),
            session_percent: session,
            session_reset_at: None,
            weekly_percent: weekly,
            weekly_reset_at: None,
            last_updated: "2026-06-21T12:00:00Z".to_string(),
            health: Some(ProviderHealth::Available),
            groups: None,
        }
    }

    fn make_grouped_snapshot(
        provider: ProviderId,
        name: &str,
        groups: Vec<(&str, f64, f64)>,
    ) -> UsageSnapshot {
        UsageSnapshot {
            provider,
            display_name: name.to_string(),
            session_percent: 0.0,
            session_reset_at: None,
            weekly_percent: 0.0,
            weekly_reset_at: None,
            last_updated: "2026-06-21T12:00:00Z".to_string(),
            health: Some(ProviderHealth::Available),
            groups: Some(
                groups
                    .into_iter()
                    .map(|(label, session, weekly)| ProviderUsageGroup {
                        label: label.to_string(),
                        session_percent: Some(session),
                        session_reset_at: None,
                        weekly_percent: Some(weekly),
                        weekly_reset_at: None,
                    })
                    .collect(),
            ),
        }
    }

    #[test]
    fn normal_usage_produces_no_alerts() {
        let mut tracker = AlertTracker::new();
        let snapshots = vec![make_snapshot(ProviderId::Claude, "Claude", 50.0, 30.0)];

        // First consume = priming
        assert!(tracker.consume(&snapshots, 75, 90, true, "all").is_empty());
        // Still normal
        assert!(tracker.consume(&snapshots, 75, 90, true, "all").is_empty());
    }

    #[test]
    fn warning_threshold_triggers_alert() {
        let mut tracker = AlertTracker::new();
        let normal = vec![make_snapshot(ProviderId::Claude, "Claude", 50.0, 30.0)];
        let warning = vec![make_snapshot(ProviderId::Claude, "Claude", 80.0, 30.0)];

        // Priming with normal baseline
        tracker.consume(&normal, 75, 90, true, "all");

        // Cross warning threshold
        let alerts = tracker.consume(&warning, 75, 90, true, "all");
        assert_eq!(alerts.len(), 1);
        assert!(alerts[0].body.contains("⚠️"));
        assert!(alerts[0].body.contains("Claude"));
        assert!(alerts[0].body.contains("Session"));
        assert!(alerts[0].body.contains("80%"));
    }

    #[test]
    fn danger_threshold_triggers_alert() {
        let mut tracker = AlertTracker::new();
        let normal = vec![make_snapshot(ProviderId::Codex, "Codex", 50.0, 30.0)];
        let danger = vec![make_snapshot(ProviderId::Codex, "Codex", 95.0, 30.0)];

        tracker.consume(&normal, 75, 90, true, "all");

        let alerts = tracker.consume(&danger, 75, 90, true, "all");
        assert_eq!(alerts.len(), 1);
        assert!(alerts[0].body.contains("⛔"));
        assert!(alerts[0].body.contains("Codex"));
    }

    #[test]
    fn same_level_does_not_retrigger() {
        let mut tracker = AlertTracker::new();
        let normal = vec![make_snapshot(ProviderId::Claude, "Claude", 50.0, 30.0)];
        let warning = vec![make_snapshot(ProviderId::Claude, "Claude", 80.0, 30.0)];

        // Priming with normal baseline (below threshold)
        tracker.consume(&normal, 75, 90, true, "all");

        // First crossing into warning fires
        let alerts = tracker.consume(&warning, 75, 90, true, "all");
        assert_eq!(alerts.len(), 1);

        // Same level again (still warning): no alert
        let still_warning = vec![make_snapshot(ProviderId::Claude, "Claude", 82.0, 30.0)];
        let alerts = tracker.consume(&still_warning, 75, 90, true, "all");
        assert!(alerts.is_empty());
    }

    #[test]
    fn fallback_to_none_then_retrigger() {
        let mut tracker = AlertTracker::new();
        let normal = vec![make_snapshot(ProviderId::Claude, "Claude", 20.0, 30.0)];
        let warning = vec![make_snapshot(ProviderId::Claude, "Claude", 80.0, 30.0)];

        // Priming with normal baseline (below threshold)
        tracker.consume(&normal, 75, 90, true, "all");

        // Cross into warning → fires
        let alerts = tracker.consume(&warning, 75, 90, true, "all");
        assert_eq!(alerts.len(), 1);

        // Fall back to none
        let alerts = tracker.consume(&normal, 75, 90, true, "all");
        assert!(alerts.is_empty());

        // Rise again → retrigger
        let alerts = tracker.consume(&warning, 75, 90, true, "all");
        assert_eq!(alerts.len(), 1);
    }

    #[test]
    fn danger_only_filters_warning() {
        let mut tracker = AlertTracker::new();
        let normal = vec![make_snapshot(ProviderId::Claude, "Claude", 50.0, 30.0)];
        let warning = vec![make_snapshot(ProviderId::Claude, "Claude", 80.0, 30.0)];
        let danger = vec![make_snapshot(ProviderId::Claude, "Claude", 95.0, 30.0)];

        tracker.consume(&normal, 75, 90, true, "danger");

        // Warning level → 被 "danger" 模式過濾掉
        let alerts = tracker.consume(&warning, 75, 90, true, "danger");
        assert!(alerts.is_empty());

        // Danger level → 通過過濾
        let alerts = tracker.consume(&danger, 75, 90, true, "danger");
        assert_eq!(alerts.len(), 1);
        assert!(alerts[0].body.contains("⛔"));
    }

    #[test]
    fn notifications_disabled_produces_no_alerts() {
        let mut tracker = AlertTracker::new();
        let normal = vec![make_snapshot(ProviderId::Claude, "Claude", 50.0, 30.0)];
        let danger = vec![make_snapshot(ProviderId::Claude, "Claude", 95.0, 30.0)];

        tracker.consume(&normal, 75, 90, false, "all");

        let alerts = tracker.consume(&danger, 75, 90, false, "all");
        assert!(alerts.is_empty());
    }

    #[test]
    fn priming_suppresses_first_alerts() {
        let mut tracker = AlertTracker::new();
        // First consume with already-over-threshold data
        let danger = vec![make_snapshot(ProviderId::Claude, "Claude", 95.0, 95.0)];

        // Priming: empty even though thresholds exceeded
        assert!(tracker.consume(&danger, 75, 90, true, "all").is_empty());

        // Same data again: no rank change → no alert
        assert!(tracker.consume(&danger, 75, 90, true, "all").is_empty());
    }

    #[test]
    fn unavailable_provider_is_skipped() {
        let mut tracker = AlertTracker::new();
        let normal = vec![make_snapshot(ProviderId::Claude, "Claude", 50.0, 30.0)];

        tracker.consume(&normal, 75, 90, true, "all");

        // Provider goes unavailable — don't update seen_levels
        let mut unavailable = make_snapshot(ProviderId::Claude, "Claude", 0.0, 0.0);
        unavailable.health = Some(ProviderHealth::Unavailable);
        tracker.consume(&[unavailable], 75, 90, true, "all");

        // Provider comes back with warning → should trigger (seen stayed at none baseline)
        let warning = vec![make_snapshot(ProviderId::Claude, "Claude", 80.0, 30.0)];
        let alerts = tracker.consume(&warning, 75, 90, true, "all");
        assert_eq!(alerts.len(), 1);
    }

    #[test]
    fn group_aware_alerts() {
        let mut tracker = AlertTracker::new();
        let normal = vec![make_grouped_snapshot(
            ProviderId::Antigravity,
            "Antigravity",
            vec![("Gemini Models", 50.0, 30.0), ("Gemini Code", 50.0, 30.0)],
        )];

        tracker.consume(&normal, 75, 90, true, "all");

        // Only one group crosses threshold
        let mixed = vec![make_grouped_snapshot(
            ProviderId::Antigravity,
            "Antigravity",
            vec![("Gemini Models", 85.0, 30.0), ("Gemini Code", 50.0, 30.0)],
        )];

        let alerts = tracker.consume(&mixed, 75, 90, true, "all");
        assert_eq!(alerts.len(), 1);
        assert!(alerts[0].body.contains("Antigravity · Gemini Models"));
        assert!(alerts[0].body.contains("Session"));
    }
}
