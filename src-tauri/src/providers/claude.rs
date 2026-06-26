use crate::models::{UsageSnapshot, ProviderId, ProviderHealth};
use crate::provider::Provider;
use async_trait::async_trait;
use std::time::Duration;
use chrono::Utc;
use serde::Deserialize;

#[derive(Deserialize, Debug)]
struct ClaudeUsageWindow {
    utilization: Option<serde_json::Value>,
    resets_at: Option<serde_json::Value>,
}

#[derive(Deserialize, Debug)]
struct ClaudeUsagePayload {
    five_hour: Option<ClaudeUsageWindow>,
    seven_day: Option<ClaudeUsageWindow>,
}

pub struct ClaudeProvider {
    client: reqwest::Client,
    session_key: Option<String>,
    organization_id: Option<String>,
}

impl ClaudeProvider {
    pub fn new(session_key: Option<String>, organization_id: Option<String>) -> Self {
        let mut headers = reqwest::header::HeaderMap::new();
        let ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
        headers.insert(
            reqwest::header::USER_AGENT,
            reqwest::header::HeaderValue::from_static(ua),
        );

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_default();

        Self {
            client,
            session_key,
            organization_id,
        }
    }

    pub async fn resolve_organization_id(&self, session_key: &str) -> anyhow::Result<String> {
        let url = "https://claude.ai/api/organizations";
        let res = self.client.get(url)
            .header("Cookie", format!("sessionKey={}", session_key))
            .send()
            .await?;

        if !res.status().is_success() {
            return Err(anyhow::anyhow!("Failed to fetch organizations: {}", res.status()));
        }

        let body_text = res.text().await?;
        for sig in &[
            ("Just a moment", "CloudflareBlocked"),
            ("Enable JavaScript and cookies to continue", "CloudflareChallenge"),
        ] {
            if body_text.contains(sig.0) {
                return Err(anyhow::anyhow!(
                    "{}: {}",
                    sig.1,
                    &body_text[..std::cmp::min(200, body_text.len())]
                ));
            }
        }

        let payload: serde_json::Value = serde_json::from_str(&body_text)?;
        let orgs = payload.as_array()
            .ok_or_else(|| anyhow::anyhow!("Organizations payload is not an array"))?;

        if orgs.is_empty() {
            return Err(anyhow::anyhow!("No organizations found"));
        }

        let first_org = &orgs[0];
        let uuid = first_org.get("uuid")
            .or_else(|| first_org.get("id"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Failed to extract organization ID"))?;

        Ok(uuid.to_string())
    }
}

fn to_number(val: &serde_json::Value) -> Option<f64> {
    match val {
        serde_json::Value::Number(num) => num.as_f64(),
        serde_json::Value::String(s) => s.trim().parse::<f64>().ok(),
        _ => None,
    }
}

#[async_trait]
impl Provider for ClaudeProvider {
    async fn snapshot(&self) -> anyhow::Result<UsageSnapshot> {
        let sess_key = std::env::var("CLAUDE_SESSION_KEY")
            .ok()
            .or_else(|| self.session_key.clone())
            .ok_or_else(|| anyhow::anyhow!("Claude sessionKey is missing"))?;

        let org_id = std::env::var("CLAUDE_ORGANIZATION_ID")
            .ok()
            .or_else(|| self.organization_id.clone())
            .ok_or_else(|| anyhow::anyhow!("Claude organizationId is missing"))?;

        let url = format!("https://claude.ai/api/organizations/{}/usage", org_id);
        let res = self.client.get(&url)
            .header("Cookie", format!("sessionKey={}", sess_key))
            .send()
            .await?;

        let status_code = res.status();
        let body_text = res.text().await?;

        // 偵測 Cloudflare 阻擋與挑戰
        for sig in &[
            ("Just a moment", "CloudflareBlocked"),
            ("Enable JavaScript and cookies to continue", "CloudflareChallenge"),
        ] {
            if body_text.contains(sig.0) {
                return Err(anyhow::anyhow!(
                    "{}: {}",
                    sig.1,
                    &body_text[..std::cmp::min(200, body_text.len())]
                ));
            }
        }

        if status_code.is_success() && body_text.trim().starts_with("<html") {
            return Err(anyhow::anyhow!(
                "UnexpectedHTML: {}",
                &body_text[..std::cmp::min(200, body_text.len())]
            ));
        }

        if !status_code.is_success() {
            return Err(anyhow::anyhow!(
                "Request failed with status {}: {}",
                status_code,
                &body_text[..std::cmp::min(200, body_text.len())]
            ));
        }

        let payload: ClaudeUsagePayload = serde_json::from_str(&body_text)?;

        let session_percent = payload.five_hour.as_ref()
            .and_then(|w| w.utilization.as_ref())
            .and_then(to_number);

        let weekly_percent = payload.seven_day.as_ref()
            .and_then(|w| w.utilization.as_ref())
            .and_then(to_number);

        let (s_pct, w_pct) = match (session_percent, weekly_percent) {
            (Some(s), Some(w)) => (s, w),
            _ => return Err(anyhow::anyhow!("Failed to parse Claude usage utilization")),
        };

        let last_updated = Utc::now().to_rfc3339();

        Ok(UsageSnapshot {
            provider: ProviderId::Claude,
            display_name: "Claude".to_string(),
            session_percent: s_pct,
            session_reset_at: payload.five_hour.and_then(|w| w.resets_at),
            weekly_percent: w_pct,
            weekly_reset_at: payload.seven_day.and_then(|w| w.resets_at),
            last_updated,
            health: Some(ProviderHealth::Available),
            groups: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_claude_provider_live() {
        let session_key = std::env::var("CLAUDE_SESSION_KEY").ok();
        let organization_id = std::env::var("CLAUDE_ORGANIZATION_ID").ok();

        if session_key.is_none() || organization_id.is_none() {
            println!("Skipping live Claude test: credentials not set in environment variables");
            return;
        }

        let provider = ClaudeProvider::new(session_key, organization_id);
        match provider.snapshot().await {
            Ok(snap) => {
                println!("Live Claude usage retrieved successfully:");
                println!("Display Name: {}", snap.display_name);
                println!("Session: {}% (reset: {:?})", snap.session_percent, snap.session_reset_at);
                println!("Weekly: {}% (reset: {:?})", snap.weekly_percent, snap.weekly_reset_at);
            }
            Err(e) => {
                println!("Failed to retrieve live Claude snapshot: {}", e);
            }
        }
    }
}
