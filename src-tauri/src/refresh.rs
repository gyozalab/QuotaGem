use std::time::Duration;

use tauri::{AppHandle, Manager};

use crate::models::load_settings;
use crate::windows::broadcast_refresh;

const DEFAULT_REFRESH_MINUTES: u32 = 5;
const MIN_REFRESH_MINUTES: u32 = 1;

const COMPACT_WINDOW_LABEL: &str = "compact";
const EXPANDED_WINDOW_LABEL: &str = "main";

/// 依設定間隔（分鐘）換算自動刷新週期，移植自 1.0 `configureAutoRefresh`：
/// `Math.max(minutes, 1) * 60_000`，下限 1 分鐘，避免 0 造成忙迴圈。
pub fn refresh_interval_ms(minutes: u32) -> u64 {
    u64::from(minutes.max(MIN_REFRESH_MINUTES)) * 60_000
}

/// 檢查是否有任何面板可見（compact 或 expanded/main）。
fn is_any_panel_visible(app: &AppHandle) -> bool {
    for label in [COMPACT_WINDOW_LABEL, EXPANDED_WINDOW_LABEL] {
        if let Some(win) = app.get_webview_window(label) {
            if win.is_visible().unwrap_or(false) {
                return true;
            }
        }
    }
    false
}

/// 面板隱藏時由後端自行 fetch 快照並跑 alert check。
/// 移植自 1.0 `checkUsageAlerts()`。
async fn check_usage_alerts(app: &AppHandle) {
    let store = load_settings();
    let prefs = store.to_preferences();
    let snapshots = crate::providers::get_all_snapshots(
        store.claude_session_key.clone(),
        store.claude_organization_id.clone(),
    )
    .await;
    crate::alerts::process_alerts(app, &snapshots, &prefs);
}

/// 啟動背景排程：每隔設定間隔自動刷新。
///
/// 移植自 1.0 `configureAutoRefresh`：
/// - 面板可見 → `broadcast_refresh`（前端接 event 後呼叫 `fetch_usage_state` → 觸發 alert）
/// - 面板隱藏 → 後端直接 fetch + alert check（不浪費前端刷新）
///
/// 每輪重讀設定，使 `save_settings` 改間隔時自動生效。
pub fn start_auto_refresh(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            let minutes = load_settings()
                .refresh_interval_minutes
                .unwrap_or(DEFAULT_REFRESH_MINUTES);
            tokio::time::sleep(Duration::from_millis(refresh_interval_ms(minutes))).await;

            if is_any_panel_visible(&app) {
                let _ = broadcast_refresh(&app);
            } else {
                check_usage_alerts(&app).await;
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::refresh_interval_ms;

    #[test]
    fn refresh_interval_uses_minutes_in_milliseconds() {
        assert_eq!(refresh_interval_ms(5), 300_000);
        assert_eq!(refresh_interval_ms(1), 60_000);
        assert_eq!(refresh_interval_ms(15), 900_000);
    }

    #[test]
    fn refresh_interval_clamps_zero_to_one_minute() {
        assert_eq!(refresh_interval_ms(0), 60_000);
    }
}

