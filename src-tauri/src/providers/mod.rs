pub mod antigravity;
pub mod claude;
pub mod codex;

use crate::models::{UsageSnapshot, ProviderId, ProviderHealth, ProviderVisibility};
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

/// 把 provider 的 Result 收斂成 snapshot；失敗時先記下原因再轉 Unavailable，
/// 避免錯誤被 `|_|` 靜默吞掉（claude / codex / antigravity 三個共用）。
fn or_unavailable(
    result: anyhow::Result<UsageSnapshot>,
    provider: ProviderId,
    display_name: &str,
) -> UsageSnapshot {
    result.unwrap_or_else(|e| {
        log::warn!("{} provider unavailable: {:#}", display_name, e);
        create_unavailable_snapshot(provider, display_name.to_string())
    })
}

pub async fn get_all_snapshots(
    claude_key: Option<String>,
    claude_org: Option<String>,
) -> Vec<UsageSnapshot> {
    get_visible_snapshots(
        claude_key,
        claude_org,
        ProviderVisibility {
            claude: true,
            codex: true,
            antigravity: true,
        },
    ).await
}

pub fn visible_provider_ids(visibility: &ProviderVisibility) -> Vec<ProviderId> {
    let mut providers = Vec::new();

    if visibility.claude {
        providers.push(ProviderId::Claude);
    }
    if visibility.codex {
        providers.push(ProviderId::Codex);
    }
    if visibility.antigravity {
        providers.push(ProviderId::Antigravity);
    }

    providers
}

pub async fn get_visible_snapshots(
    claude_key: Option<String>,
    claude_org: Option<String>,
    visibility: ProviderVisibility,
) -> Vec<UsageSnapshot> {
    let claude = claude::ClaudeProvider::new(claude_key, claude_org);
    let codex = codex::CodexProvider::new();
    let antigravity = antigravity::AntigravityProvider::new();

    match (visibility.claude, visibility.codex, visibility.antigravity) {
        (true, true, true) => {
            let (claude_res, codex_res, antigravity_res) = tokio::join!(
                claude.snapshot(),
                codex.snapshot(),
                antigravity.snapshot()
            );

            vec![
                or_unavailable(claude_res, ProviderId::Claude, "Claude"),
                or_unavailable(codex_res, ProviderId::Codex, "Codex"),
                or_unavailable(antigravity_res, ProviderId::Antigravity, "Antigravity"),
            ]
        }
        (true, true, false) => {
            let (claude_res, codex_res) = tokio::join!(claude.snapshot(), codex.snapshot());

            vec![
                or_unavailable(claude_res, ProviderId::Claude, "Claude"),
                or_unavailable(codex_res, ProviderId::Codex, "Codex"),
            ]
        }
        (true, false, true) => {
            let (claude_res, antigravity_res) = tokio::join!(claude.snapshot(), antigravity.snapshot());

            vec![
                or_unavailable(claude_res, ProviderId::Claude, "Claude"),
                or_unavailable(antigravity_res, ProviderId::Antigravity, "Antigravity"),
            ]
        }
        (false, true, true) => {
            let (codex_res, antigravity_res) = tokio::join!(codex.snapshot(), antigravity.snapshot());

            vec![
                or_unavailable(codex_res, ProviderId::Codex, "Codex"),
                or_unavailable(antigravity_res, ProviderId::Antigravity, "Antigravity"),
            ]
        }
        (true, false, false) => vec![or_unavailable(claude.snapshot().await, ProviderId::Claude, "Claude")],
        (false, true, false) => vec![or_unavailable(codex.snapshot().await, ProviderId::Codex, "Codex")],
        (false, false, true) => vec![or_unavailable(antigravity.snapshot().await, ProviderId::Antigravity, "Antigravity")],
        (false, false, false) => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn visible_provider_ids_excludes_hidden_antigravity() {
        let providers = visible_provider_ids(&ProviderVisibility {
            claude: true,
            codex: true,
            antigravity: false,
        });

        assert_eq!(providers, vec![ProviderId::Claude, ProviderId::Codex]);
    }

    #[tokio::test]
    async fn visible_snapshots_exclude_hidden_antigravity() {
        let snapshots = get_visible_snapshots(
            None,
            None,
            ProviderVisibility {
                claude: true,
                codex: true,
                antigravity: false,
            },
        ).await;

        assert_eq!(snapshots.len(), 2);
        assert!(snapshots.iter().any(|snapshot| snapshot.provider == ProviderId::Claude));
        assert!(snapshots.iter().any(|snapshot| snapshot.provider == ProviderId::Codex));
        assert!(!snapshots.iter().any(|snapshot| snapshot.provider == ProviderId::Antigravity));
    }

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

