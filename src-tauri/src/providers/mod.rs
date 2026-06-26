pub mod antigravity;
pub mod claude;
pub mod codex;

use crate::models::{UsageSnapshot, ProviderId, ProviderHealth};
use crate::provider::Provider;

pub fn create_unavailable_snapshot(provider: ProviderId, display_name: String) -> UsageSnapshot {
    UsageSnapshot {
        provider,
        display_name,
        session_percent: 0.0,
        session_reset_at: None,
        weekly_percent: 0.0,
        weekly_reset_at: None,
        last_updated: "".to_string(),
        health: Some(ProviderHealth::Unavailable),
        groups: None,
    }
}

pub async fn get_all_snapshots(
    claude_key: Option<String>,
    claude_org: Option<String>,
) -> Vec<UsageSnapshot> {
    let claude = claude::ClaudeProvider::new(claude_key, claude_org);
    let codex = codex::CodexProvider::new();
    let antigravity = antigravity::AntigravityProvider::new();

    let (claude_res, codex_res, antigravity_res) = tokio::join!(
        claude.snapshot(),
        codex.snapshot(),
        antigravity.snapshot()
    );

    vec![
        claude_res.unwrap_or_else(|_| create_unavailable_snapshot(ProviderId::Claude, "Claude".to_string())),
        codex_res.unwrap_or_else(|_| create_unavailable_snapshot(ProviderId::Codex, "Codex".to_string())),
        antigravity_res.unwrap_or_else(|_| create_unavailable_snapshot(ProviderId::Antigravity, "Antigravity".to_string())),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_aggregation_fault_tolerance() {
        let snapshots = get_all_snapshots(None, None).await;
        assert_eq!(snapshots.len(), 3);
        
        let claude = snapshots.iter().find(|s| s.provider == ProviderId::Claude).unwrap();
        assert_eq!(claude.health, Some(ProviderHealth::Unavailable));
        
        let codex = snapshots.iter().find(|s| s.provider == ProviderId::Codex).unwrap();
        assert!(codex.health == Some(ProviderHealth::Available) || codex.health == Some(ProviderHealth::Unavailable));
    }
}

