use serde::{Serialize, Deserialize};

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
