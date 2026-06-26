use crate::models::{UsageSnapshot, ProviderId, ProviderHealth, ProviderUsageGroup};
use crate::provider::Provider;
use async_trait::async_trait;
use std::time::Duration;
use chrono::Utc;
use serde::Deserialize;

#[derive(Deserialize, Debug)]
struct DiscoveredProcess {
    #[serde(rename = "processId")]
    _process_id: u32,
    #[serde(rename = "commandLine")]
    command_line: Option<String>,
    ports: Option<serde_json::Value>,
}

#[derive(Deserialize, Debug)]
struct AntigravityQuotaBucket {
    window: Option<String>,
    #[serde(rename = "remainingFraction")]
    remaining_fraction: Option<f64>,
    #[serde(rename = "resetTime")]
    reset_time: Option<serde_json::Value>,
}

#[derive(Deserialize, Debug)]
struct AntigravityQuotaGroup {
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    buckets: Option<Vec<AntigravityQuotaBucket>>,
}

#[derive(Deserialize, Debug)]
struct AntigravityQuotaSummary {
    response: Option<AntigravityQuotaSummaryResponse>,
}

#[derive(Deserialize, Debug)]
struct AntigravityQuotaSummaryResponse {
    groups: Option<Vec<AntigravityQuotaGroup>>,
}

pub struct AntigravityProvider {
    client: reqwest::Client,
}

impl AntigravityProvider {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .danger_accept_invalid_certs(true) // 接受 127.0.0.1 自簽憑證
            .timeout(Duration::from_millis(2500))
            .build()
            .unwrap_or_default();
        Self { client }
    }

    async fn post_rpc(&self, port: u16, scheme: &str, csrf: &str, method: &str) -> Option<serde_json::Value> {
        let url = format!(
            "{}://127.0.0.1:{}/exa.language_server_pb.LanguageServerService/{}",
            scheme, port, method
        );
        let res = self.client.post(&url)
            .header("Content-Type", "application/json")
            .header("Connect-Protocol-Version", "1")
            .header("X-Codeium-Csrf-Token", csrf)
            .body("{}")
            .send()
            .await;

        match res {
            Ok(response) => {
                if response.status().is_success() {
                    response.json::<serde_json::Value>().await.ok()
                } else {
                    None
                }
            }
            Err(_) => None,
        }
    }
}

fn extract_csrf(cmd_line: &str) -> Option<String> {
    let token_flag = "--csrf_token";
    if let Some(idx) = cmd_line.find(token_flag) {
        let sub = &cmd_line[idx + token_flag.len()..];
        let mut parts = sub.split_whitespace();
        parts.next().map(|s| s.to_string())
    } else {
        None
    }
}

fn extract_ports(ports_val: &serde_json::Value) -> Vec<u16> {
    match ports_val {
        serde_json::Value::Number(num) => {
            if let Some(port) = num.as_u64() {
                vec![port as u16]
            } else {
                vec![]
            }
        }
        serde_json::Value::Array(arr) => {
            arr.iter()
                .filter_map(|val| {
                    match val {
                        serde_json::Value::Number(num) => num.as_u64().map(|p| p as u16),
                        serde_json::Value::String(s) => s.parse::<u16>().ok(),
                        _ => None,
                    }
                })
                .collect()
        }
        serde_json::Value::String(s) => {
            if let Ok(port) = s.parse::<u16>() {
                vec![port]
            } else {
                vec![]
            }
        }
        _ => vec![],
    }
}

fn is_logged_in(status: &serde_json::Value) -> bool {
    status.pointer("/userStatus/planStatus").is_some()
}

fn used_percent_from_fraction(fraction: f64) -> Option<f64> {
    if fraction < 0.0 || fraction > 1.0 {
        None
    } else {
        Some((1.0 - fraction) * 100.0)
    }
}

fn find_bucket(buckets: &[AntigravityQuotaBucket], target_window: &str) -> Option<AntigravityQuotaBucket> {
    buckets.iter()
        .find(|b| {
            b.window.as_ref()
                .map(|w| w.trim().to_lowercase() == target_window)
                .unwrap_or(false)
        })
        .map(|b| AntigravityQuotaBucket {
            window: b.window.clone(),
            remaining_fraction: b.remaining_fraction,
            reset_time: b.reset_time.clone(),
        })
}

fn pick_tightest(groups: &[ProviderUsageGroup], is_session: bool) -> Option<(f64, Option<serde_json::Value>)> {
    let mut best: Option<(f64, Option<serde_json::Value>)> = None;
    for g in groups {
        let percent = if is_session { g.session_percent } else { g.weekly_percent };
        let reset_at = if is_session { &g.session_reset_at } else { &g.weekly_reset_at };
        if let Some(p) = percent {
            if best.is_none() || p > best.as_ref().unwrap().0 {
                best = Some((p, reset_at.clone()));
            }
        }
    }
    best
}

fn extract_antigravity_quota(summary: serde_json::Value, last_updated: String) -> Option<UsageSnapshot> {
    let summary_struct: AntigravityQuotaSummary = serde_json::from_value(summary).ok()?;
    let groups = summary_struct.response?.groups?;

    let mut parsed_groups = Vec::new();
    for group in groups {
        let label = group.display_name?;
        let buckets = group.buckets.unwrap_or_default();

        let five_hour = find_bucket(&buckets, "5h");
        let weekly = find_bucket(&buckets, "weekly");

        let session_percent = five_hour.as_ref()
            .and_then(|b| b.remaining_fraction)
            .and_then(used_percent_from_fraction);

        let weekly_percent = weekly.as_ref()
            .and_then(|b| b.remaining_fraction)
            .and_then(used_percent_from_fraction);

        if session_percent.is_none() && weekly_percent.is_none() {
            continue;
        }

        parsed_groups.push(ProviderUsageGroup {
            label,
            session_percent,
            session_reset_at: if session_percent.is_some() {
                five_hour.and_then(|b| b.reset_time)
            } else {
                None
            },
            weekly_percent,
            weekly_reset_at: if weekly_percent.is_some() {
                weekly.and_then(|b| b.reset_time)
            } else {
                None
            },
        });
    }

    if parsed_groups.is_empty() {
        return None;
    }

    let top_session = pick_tightest(&parsed_groups, true);
    let top_weekly = pick_tightest(&parsed_groups, false);

    Some(UsageSnapshot {
        provider: ProviderId::Antigravity,
        display_name: "Antigravity".to_string(),
        session_percent: top_session.as_ref().map(|t| t.0).unwrap_or(0.0),
        session_reset_at: top_session.and_then(|t| t.1),
        weekly_percent: top_weekly.as_ref().map(|t| t.0).unwrap_or(0.0),
        weekly_reset_at: top_weekly.and_then(|t| t.1),
        last_updated,
        health: Some(ProviderHealth::Available),
        groups: Some(parsed_groups),
    })
}

#[async_trait]
impl Provider for AntigravityProvider {
    async fn snapshot(&self) -> anyhow::Result<UsageSnapshot> {
        let command = r#"
        $processes = @(Get-CimInstance Win32_Process | Where-Object {
          $_.ProcessId -ne $PID -and $_.CommandLine -match '--csrf_token'
        })
        $connections = if ($processes.Count -gt 0) {
          @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue)
        } else {
          @()
        }
        @($processes | ForEach-Object {
          $processId = $_.ProcessId
          [pscustomobject]@{
            processId = $processId
            commandLine = $_.CommandLine
            ports = @($connections | Where-Object { $_.OwningProcess -eq $processId } | ForEach-Object { $_.LocalPort })
          }
        }) | ConvertTo-Json -Compress -Depth 3
        "#;

        let mut cmd = std::process::Command::new("powershell.exe");
        cmd.args(&["-NoProfile", "-NonInteractive", "-Command", command]);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let output = cmd.output()?;
        if !output.status.success() {
            return Err(anyhow::anyhow!("PowerShell discovery command failed"));
        }

        let stdout_str = String::from_utf8_lossy(&output.stdout);
        let parsed_json: serde_json::Value = serde_json::from_str(&stdout_str).unwrap_or(serde_json::Value::Null);

        let processes = match parsed_json {
            serde_json::Value::Array(arr) => arr,
            serde_json::Value::Object(obj) => vec![serde_json::Value::Object(obj)],
            _ => vec![],
        };

        for p_val in processes {
            let proc: DiscoveredProcess = match serde_json::from_value(p_val) {
                Ok(p) => p,
                Err(_) => continue,
            };

            let cmd_line = match proc.command_line {
                Some(ref c) if !c.is_empty() => c,
                _ => continue,
            };

            let csrf = match extract_csrf(cmd_line) {
                Some(c) => c,
                None => continue,
            };

            let ports_val = match proc.ports {
                Some(ref val) => val,
                None => continue,
            };

            let ports = extract_ports(ports_val);

            for port in ports {
                for scheme in &["http", "https"] {
                    let status_val = self.post_rpc(port, scheme, &csrf, "GetUserStatus").await;
                    let status = match status_val {
                        Some(ref val) => val,
                        None => continue,
                    };

                    if !is_logged_in(status) {
                        continue;
                    }

                    let summary = self.post_rpc(port, scheme, &csrf, "RetrieveUserQuotaSummary").await;
                    if let Some(sum_val) = summary {
                        let last_updated = Utc::now().to_rfc3339();
                        if let Some(snap) = extract_antigravity_quota(sum_val, last_updated) {
                            return Ok(snap);
                        }
                    }
                }
            }
        }

        Err(anyhow::anyhow!("No logged-in Antigravity language server found"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_antigravity_provider_live() {
        let provider = AntigravityProvider::new();
        match provider.snapshot().await {
            Ok(snap) => {
                println!("Live Antigravity usage retrieved successfully:");
                println!("Display Name: {}", snap.display_name);
                println!("Session: {}% (reset: {:?})", snap.session_percent, snap.session_reset_at);
                println!("Weekly: {}% (reset: {:?})", snap.weekly_percent, snap.weekly_reset_at);
                if let Some(groups) = snap.groups {
                    for g in groups {
                        println!("  Group: {}", g.label);
                        println!("    Session: {:?}%", g.session_percent);
                        println!("    Weekly: {:?}%", g.weekly_percent);
                    }
                }
            }
            Err(e) => {
                println!("Failed to retrieve live Antigravity snapshot: {}", e);
            }
        }
    }

    #[test]
    fn test_antigravity_quota_parsing_fixture() {
        let fixture_str = r#"{
          "response": {
            "groups": [
              {
                "displayName": "Gemini Models",
                "buckets": [
                  {
                    "window": "weekly",
                    "remainingFraction": 0.96395016,
                    "resetTime": "2026-06-22T06:32:23Z"
                  },
                  {
                    "window": "5h",
                    "remainingFraction": 0.9967988,
                    "resetTime": "2026-06-19T15:57:12Z"
                  }
                ]
              },
              {
                "displayName": "Claude and GPT models",
                "buckets": [
                  {
                    "window": "weekly",
                    "remainingFraction": 1,
                    "resetTime": "2026-06-26T11:42:55Z"
                  },
                  {
                    "window": "5h",
                    "remainingFraction": 1,
                    "resetTime": "2026-06-19T16:42:55Z"
                  }
                ]
              }
            ]
          }
        }"#;

        let summary: serde_json::Value = serde_json::from_str(fixture_str).unwrap();
        let snap = extract_antigravity_quota(summary, "2026-06-19T20:00:00Z".to_string()).unwrap();

        assert_eq!(snap.provider, ProviderId::Antigravity);
        assert_eq!(snap.display_name, "Antigravity");
        assert_eq!(snap.health, Some(ProviderHealth::Available));
        assert_eq!(snap.last_updated, "2026-06-19T20:00:00Z");

        let groups = snap.groups.unwrap();
        assert_eq!(groups.len(), 2);

        let gemini = groups.iter().find(|g| g.label == "Gemini Models").unwrap();
        assert!((gemini.session_percent.unwrap() - 0.32012).abs() < 1e-4);
        assert_eq!(gemini.session_reset_at.as_ref().unwrap().as_str().unwrap(), "2026-06-19T15:57:12Z");
        assert!((gemini.weekly_percent.unwrap() - 3.604984).abs() < 1e-4);
        assert_eq!(gemini.weekly_reset_at.as_ref().unwrap().as_str().unwrap(), "2026-06-22T06:32:23Z");

        let claude_gpt = groups.iter().find(|g| g.label == "Claude and GPT models").unwrap();
        assert_eq!(claude_gpt.session_percent.unwrap(), 0.0);
        assert_eq!(claude_gpt.weekly_percent.unwrap(), 0.0);

        assert!((snap.session_percent - 0.32012).abs() < 1e-4);
        assert_eq!(snap.session_reset_at.as_ref().unwrap().as_str().unwrap(), "2026-06-19T15:57:12Z");
        assert!((snap.weekly_percent - 3.604984).abs() < 1e-4);
        assert_eq!(snap.weekly_reset_at.as_ref().unwrap().as_str().unwrap(), "2026-06-22T06:32:23Z");
    }
}
