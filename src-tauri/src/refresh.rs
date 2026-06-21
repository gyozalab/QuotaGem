use std::time::Duration;

use tauri::AppHandle;

use crate::models::load_settings;
use crate::windows::broadcast_refresh;

const DEFAULT_REFRESH_MINUTES: u32 = 5;
const MIN_REFRESH_MINUTES: u32 = 1;

/// 依設定間隔（分鐘）換算自動刷新週期，移植自 1.0 `configureAutoRefresh`：
/// `Math.max(minutes, 1) * 60_000`，下限 1 分鐘，避免 0 造成忙迴圈。
pub fn refresh_interval_ms(minutes: u32) -> u64 {
    u64::from(minutes.max(MIN_REFRESH_MINUTES)) * 60_000
}

/// 啟動背景排程：每隔設定間隔對可見面板廣播一次刷新請求。
/// 每輪重讀設定，使後續 `save_settings`（task 5.3）改間隔時自動生效。
pub fn start_auto_refresh(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            let minutes = load_settings()
                .refresh_interval_minutes
                .unwrap_or(DEFAULT_REFRESH_MINUTES);
            tokio::time::sleep(Duration::from_millis(refresh_interval_ms(minutes))).await;
            let _ = broadcast_refresh(&app);
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
