use serde::{Serialize, Deserialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ProviderId {
    Claude,
    Codex,
    Antigravity,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ProviderHealth {
    Available,
    Stale,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderUsageGroup {
    pub label: String,
    pub session_percent: Option<f64>,
    pub session_reset_at: Option<serde_json::Value>,
    pub weekly_percent: Option<f64>,
    pub weekly_reset_at: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UsageSnapshot {
    pub provider: ProviderId,
    pub display_name: String,
    pub session_percent: f64,
    pub session_reset_at: Option<serde_json::Value>,
    pub weekly_percent: f64,
    pub weekly_reset_at: Option<serde_json::Value>,
    pub last_updated: String,
    pub health: Option<ProviderHealth>,
    pub groups: Option<Vec<ProviderUsageGroup>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderVisibility {
    pub claude: bool,
    pub codex: bool,
    pub antigravity: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WidgetPreferences {
    pub preferred_display_mode: String,
    pub launch_at_login: bool,
    pub provider_visibility: ProviderVisibility,
    pub refresh_interval_minutes: u32,
    pub warning_threshold: u32,
    pub danger_threshold: u32,
    pub notifications_enabled: bool,
    pub notification_level: String,
    pub language: String,
    pub time_display: String,
    pub time_format: String,
    pub date_format: String,
    pub panel_scale: f64,
    pub panel_opacity: f64,
    pub panel_tone: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStore {
    pub claude_session_key: Option<String>,
    pub claude_organization_id: Option<String>,
    pub preferred_display_mode: Option<String>,
    pub launch_at_login: Option<bool>,
    pub provider_visibility: Option<serde_json::Value>,
    pub refresh_interval_minutes: Option<u32>,
    pub warning_threshold: Option<u32>,
    pub danger_threshold: Option<u32>,
    pub notifications_enabled: Option<bool>,
    pub notification_level: Option<String>,
    pub language: Option<String>,
    pub time_display: Option<String>,
    pub time_format: Option<String>,
    pub date_format: Option<String>,
    pub panel_scale: Option<f64>,
    pub panel_opacity: Option<f64>,
    pub panel_tone: Option<String>,
}

impl Default for AppStore {
    fn default() -> Self {
        Self {
            claude_session_key: None,
            claude_organization_id: None,
            preferred_display_mode: Some("expanded".to_string()),
            launch_at_login: Some(false),
            provider_visibility: None,
            refresh_interval_minutes: Some(5),
            warning_threshold: Some(75),
            danger_threshold: Some(90),
            notifications_enabled: Some(true),
            notification_level: Some("all".to_string()),
            language: Some("en".to_string()),
            time_display: Some("utc".to_string()),
            time_format: Some("24h".to_string()),
            date_format: Some("iso".to_string()),
            panel_scale: Some(100.0),
            panel_opacity: Some(90.0),
            panel_tone: Some("charcoal".to_string()),
        }
    }
}

pub fn coerce_provider_visibility(val: &Option<serde_json::Value>) -> ProviderVisibility {
    let mut claude = true;
    let mut codex = true;
    let mut antigravity = true;

    if let Some(ref v) = val {
        if let Some(s) = v.as_str() {
            match s {
                "claude" => {
                    codex = false;
                    antigravity = false;
                }
                "codex" => {
                    claude = false;
                    antigravity = false;
                }
                "both" => {}
                _ => {}
            }
        } else if let Some(obj) = v.as_object() {
            claude = obj.get("claude").and_then(|x| x.as_bool()).unwrap_or(true);
            codex = obj.get("codex").and_then(|x| x.as_bool()).unwrap_or(true);
            antigravity = obj.get("antigravity").and_then(|x| x.as_bool()).unwrap_or(true);
        }
    }

    ProviderVisibility {
        claude,
        codex,
        antigravity,
    }
}

pub fn get_settings_path() -> Option<PathBuf> {
    std::env::var("APPDATA")
        .ok()
        .map(|appdata| PathBuf::from(appdata).join("quota-gem").join("quota-gem.json"))
}

pub fn load_settings() -> AppStore {
    if let Some(path) = get_settings_path() {
        if path.exists() {
            if let Ok(content) = std::fs::read_to_string(path) {
                if let Ok(store) = serde_json::from_str::<AppStore>(&content) {
                    return store;
                }
            }
        }
    }
    AppStore::default()
}

pub fn save_settings(store: &AppStore) -> std::io::Result<()> {
    if let Some(path) = get_settings_path() {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(store)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        std::fs::write(path, content)?;
    }
    Ok(())
}

impl AppStore {
    pub fn to_preferences(&self) -> WidgetPreferences {
        WidgetPreferences {
            preferred_display_mode: self.preferred_display_mode.clone().unwrap_or_else(|| "expanded".to_string()),
            launch_at_login: self.launch_at_login.unwrap_or(false),
            provider_visibility: coerce_provider_visibility(&self.provider_visibility),
            refresh_interval_minutes: self.refresh_interval_minutes.unwrap_or(5),
            warning_threshold: self.warning_threshold.unwrap_or(75),
            danger_threshold: self.danger_threshold.unwrap_or(90),
            notifications_enabled: self.notifications_enabled.unwrap_or(true),
            notification_level: self.notification_level.clone().unwrap_or_else(|| "all".to_string()),
            language: self.language.clone().unwrap_or_else(|| "en".to_string()),
            time_display: self.time_display.clone().unwrap_or_else(|| "utc".to_string()),
            time_format: self.time_format.clone().unwrap_or_else(|| "24h".to_string()),
            date_format: self.date_format.clone().unwrap_or_else(|| "iso".to_string()),
            panel_scale: self.panel_scale.unwrap_or(100.0),
            panel_opacity: self.panel_opacity.unwrap_or(90.0),
            panel_tone: self.panel_tone.clone().unwrap_or_else(|| "charcoal".to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::coerce_provider_visibility;

    #[test]
    fn legacy_both_visibility_enables_all_three_providers() {
        let visibility = coerce_provider_visibility(&Some(serde_json::json!("both")));

        assert!(visibility.claude);
        assert!(visibility.codex);
        assert!(visibility.antigravity);
    }

    #[test]
    fn test_settings_round_trip() {
        // 模擬 1.0 寫的 config JSON 格式
        let legacy_json = r#"{
            "claudeSessionKey": "session-123",
            "claudeOrganizationId": "org-456",
            "preferredDisplayMode": "compact",
            "launchAtLogin": true,
            "providerVisibility": {
                "claude": true,
                "codex": false,
                "antigravity": true
            },
            "refreshIntervalMinutes": 15,
            "warningThreshold": 65,
            "dangerThreshold": 85,
            "notificationsEnabled": false,
            "notificationLevel": "danger",
            "language": "zh-TW",
            "timeDisplay": "local",
            "timeFormat": "12h",
            "dateFormat": "dmy",
            "panelScale": 115.0,
            "panelOpacity": 86.0,
            "panelTone": "linen"
        }"#;

        // 1. 驗證讀取（Deserialize） 1.0 的設定相容性
        let store: super::AppStore = serde_json::from_str(legacy_json).unwrap();
        assert_eq!(store.claude_session_key.as_deref(), Some("session-123"));
        assert_eq!(store.claude_organization_id.as_deref(), Some("org-456"));
        assert_eq!(store.preferred_display_mode.as_deref(), Some("compact"));
        assert_eq!(store.launch_at_login, Some(true));
        assert_eq!(store.refresh_interval_minutes, Some(15));
        assert_eq!(store.warning_threshold, Some(65));
        assert_eq!(store.danger_threshold, Some(85));
        assert_eq!(store.notifications_enabled, Some(false));
        assert_eq!(store.notification_level.as_deref(), Some("danger"));
        assert_eq!(store.language.as_deref(), Some("zh-TW"));
        assert_eq!(store.time_display.as_deref(), Some("local"));
        assert_eq!(store.time_format.as_deref(), Some("12h"));
        assert_eq!(store.date_format.as_deref(), Some("dmy"));
        assert_eq!(store.panel_scale, Some(115.0));
        assert_eq!(store.panel_opacity, Some(86.0));
        assert_eq!(store.panel_tone.as_deref(), Some("linen"));

        // 2. 驗證寫入（Serialize）與儲存流程
        let test_path = std::env::temp_dir().join(format!("quota-gem-test-{}.json", chrono::Utc::now().timestamp_millis()));

        // 模擬寫入
        let content = serde_json::to_string_pretty(&store).unwrap();
        std::fs::write(&test_path, content).unwrap();

        // 重新讀回並校對
        let read_content = std::fs::read_to_string(&test_path).unwrap();
        let read_store: super::AppStore = serde_json::from_str(&read_content).unwrap();
        assert_eq!(read_store.claude_session_key, store.claude_session_key);
        assert_eq!(read_store.panel_tone, store.panel_tone);

        // 清理臨時檔案
        if test_path.exists() {
            let _ = std::fs::remove_file(&test_path);
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageStateResponse {
    pub snapshots: Vec<UsageSnapshot>,
    pub preferences: WidgetPreferences,
}

