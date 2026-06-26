use crate::models::{UsageSnapshot, ProviderId, ProviderHealth};
use crate::provider::Provider;
use async_trait::async_trait;
use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Deserialize, Debug)]
struct CodexRateLimitTrack {
    #[serde(rename = "used_percent")]
    used_percent: Option<f64>,
    #[serde(rename = "resets_at")]
    resets_at: Option<serde_json::Value>,
}

#[derive(Deserialize, Debug)]
struct CodexRateLimits {
    primary: Option<CodexRateLimitTrack>,
    secondary: Option<CodexRateLimitTrack>,
}

#[derive(Deserialize, Debug)]
struct CodexTokenCountPayload {
    r#type: Option<String>,
    rate_limits: Option<CodexRateLimits>,
}

#[derive(Deserialize, Debug)]
struct CodexJsonlEvent {
    timestamp: Option<String>,
    payload: Option<CodexTokenCountPayload>,
}

pub struct CodexProvider {}

impl CodexProvider {
    pub fn new() -> Self {
        Self {}
    }
}

fn walk_dir(dir: &Path, files: &mut Vec<(PathBuf, SystemTime)>) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                walk_dir(&path, files);
            } else if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                if let Ok(metadata) = entry.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        files.push((path, modified));
                    }
                }
            }
        }
    }
}

fn find_newest_jsonl_file(root: &Path) -> Option<PathBuf> {
    let mut files = Vec::new();
    walk_dir(root, &mut files);
    if files.is_empty() {
        return None;
    }
    // 降序排列修改時間，取最新的一個
    files.sort_by(|a, b| b.1.cmp(&a.1));
    files.first().map(|(path, _)| path.clone())
}

#[async_trait]
impl Provider for CodexProvider {
    async fn snapshot(&self) -> anyhow::Result<UsageSnapshot> {
        let home = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .map(PathBuf::from)
            .map_err(|_| anyhow::anyhow!("Home directory path not found"))?;

        let sessions_root = home.join(".codex").join("sessions");
        let latest_file = find_newest_jsonl_file(&sessions_root)
            .ok_or_else(|| anyhow::anyhow!("No Codex JSONL session files found"))?;

        let content = std::fs::read_to_string(&latest_file)?;
        let mut token_count_event: Option<CodexJsonlEvent> = None;

        for line in content.lines().rev() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            if let Ok(event) = serde_json::from_str::<CodexJsonlEvent>(trimmed) {
                if let Some(ref payload) = event.payload {
                    if payload.r#type.as_deref() == Some("token_count") {
                        token_count_event = Some(event);
                        break;
                    }
                }
            }
        }

        let event = token_count_event
            .ok_or_else(|| anyhow::anyhow!("No token_count event found in latest session log"))?;

        let timestamp = event.timestamp
            .ok_or_else(|| anyhow::anyhow!("Codex event timestamp is missing"))?;

        let rate_limits = event.payload
            .and_then(|p| p.rate_limits)
            .ok_or_else(|| anyhow::anyhow!("Codex rate limits payload is missing"))?;

        let primary = rate_limits.primary
            .ok_or_else(|| anyhow::anyhow!("Codex primary rate limit track is missing"))?;

        let secondary = rate_limits.secondary
            .ok_or_else(|| anyhow::anyhow!("Codex secondary rate limit track is missing"))?;

        let session_percent = primary.used_percent
            .ok_or_else(|| anyhow::anyhow!("Codex primary used_percent is missing"))?;

        let weekly_percent = secondary.used_percent
            .ok_or_else(|| anyhow::anyhow!("Codex secondary used_percent is missing"))?;

        Ok(UsageSnapshot {
            provider: ProviderId::Codex,
            display_name: "Codex".to_string(),
            session_percent,
            session_reset_at: primary.resets_at,
            weekly_percent,
            weekly_reset_at: secondary.resets_at,
            last_updated: timestamp,
            health: Some(ProviderHealth::Available),
            groups: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_codex_provider_live() {
        let provider = CodexProvider::new();
        match provider.snapshot().await {
            Ok(snap) => {
                println!("Live Codex usage retrieved successfully:");
                println!("Display Name: {}", snap.display_name);
                println!("Session: {}% (reset: {:?})", snap.session_percent, snap.session_reset_at);
                println!("Weekly: {}% (reset: {:?})", snap.weekly_percent, snap.weekly_reset_at);
            }
            Err(e) => {
                println!("Failed to retrieve live Codex snapshot: {}", e);
            }
        }
    }
}
