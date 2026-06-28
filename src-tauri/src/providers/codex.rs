use crate::models::{UsageSnapshot, ProviderId, ProviderHealth};
use crate::provider::Provider;
use async_trait::async_trait;
use chrono::Utc;
use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{Duration, SystemTime};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

// ── JSONL fallback 用的結構（舊資料源，僅在 app-server 取不到時使用）──────────

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

// ── app-server 主路徑：spawn `codex app-server`，JSON-RPC over stdio ─────────

/// 解析 `account/rateLimits/read` 回應的 `result` 物件，產出 UsageSnapshot。
/// 純函式，不做 IO，方便 fixture 測試。
fn parse_rate_limits_response(result: &serde_json::Value) -> anyhow::Result<UsageSnapshot> {
    let rate_limits = result
        .get("rateLimits")
        .ok_or_else(|| anyhow::anyhow!("app-server 回應缺少 rateLimits"))?;

    let mut session_percent = 0.0_f64;
    let mut session_reset_at: Option<serde_json::Value> = None;
    let mut weekly_percent = 0.0_f64;
    let mut weekly_reset_at: Option<serde_json::Value> = None;
    let mut found = false;

    // primary / secondary 哪個是 5h、哪個是週，依 windowDurationMins 判斷，不寫死順序。
    for key in ["primary", "secondary"] {
        let window = match rate_limits.get(key) {
            Some(w) if !w.is_null() => w,
            _ => continue,
        };
        let used = match window.get("usedPercent").and_then(|v| v.as_f64()) {
            Some(u) => u,
            None => continue,
        };
        let dur = window
            .get("windowDurationMins")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        let reset = window.get("resetsAt").cloned();
        found = true;
        if dur <= 360 {
            // 5 小時視窗（300 分）
            session_percent = used;
            session_reset_at = reset;
        } else {
            // 週視窗（10080 分）
            weekly_percent = used;
            weekly_reset_at = reset;
        }
    }

    if !found {
        return Err(anyhow::anyhow!("app-server rateLimits 沒有可用的視窗資料"));
    }

    Ok(UsageSnapshot {
        provider: ProviderId::Codex,
        display_name: "Codex".to_string(),
        session_percent,
        session_reset_at,
        weekly_percent,
        weekly_reset_at,
        last_updated: Utc::now().to_rfc3339(),
        health: Some(ProviderHealth::Available),
        groups: None,
    })
}

/// 定位 codex 執行檔。GUI app 從 Explorer 啟動時 PATH 不一定有 codex，
/// 所以優先找桌面版安裝的真實 exe，最後才退回 PATH 上的 `codex`。
fn find_codex_command() -> String {
    // 1) %LOCALAPPDATA%\OpenAI\Codex\bin\<hash>\codex.exe（桌面版安裝路徑，最可靠）
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let bin = PathBuf::from(&local)
            .join("OpenAI")
            .join("Codex")
            .join("bin");
        if let Ok(entries) = std::fs::read_dir(&bin) {
            for entry in entries.flatten() {
                let exe = entry.path().join("codex.exe");
                if exe.is_file() {
                    return exe.to_string_lossy().into_owned();
                }
            }
        }
    }
    // 2) 退回 PATH 上的 codex（從終端啟動時可用）
    "codex".to_string()
}

async fn write_line(
    stdin: &mut tokio::process::ChildStdin,
    value: &serde_json::Value,
) -> anyhow::Result<()> {
    let mut line = serde_json::to_string(value)?;
    line.push('\n');
    stdin.write_all(line.as_bytes()).await?;
    stdin.flush().await?;
    Ok(())
}

/// 讀 stdout 直到出現指定 id 的 JSON-RPC 回應；中途的 notification（無 id）一律略過。
async fn read_until_id(
    reader: &mut tokio::io::Lines<BufReader<tokio::process::ChildStdout>>,
    id: i64,
) -> anyhow::Result<serde_json::Value> {
    while let Some(line) = reader.next_line().await? {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
            if val.get("id").and_then(|v| v.as_i64()) == Some(id) {
                if let Some(err) = val.get("error") {
                    return Err(anyhow::anyhow!("app-server 回傳錯誤: {}", err));
                }
                return Ok(val);
            }
        }
    }
    Err(anyhow::anyhow!("app-server 在 id={} 回應前就關閉了", id))
}

/// spawn `codex app-server`，跑 initialize 握手後呼叫 `account/rateLimits/read`。
async fn query_app_server(codex: String) -> anyhow::Result<UsageSnapshot> {
    let mut cmd = tokio::process::Command::new(&codex);
    cmd.arg("app-server")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true);
    #[cfg(windows)]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn()?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| anyhow::anyhow!("無法取得 app-server stdin"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| anyhow::anyhow!("無法取得 app-server stdout"))?;
    let mut reader = BufReader::new(stdout).lines();

    // 1) initialize（clientInfo 必填）
    let init = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "clientInfo": { "name": "quotagem", "title": "QuotaGem", "version": env!("CARGO_PKG_VERSION") },
            "capabilities": {}
        }
    });
    write_line(&mut stdin, &init).await?;
    read_until_id(&mut reader, 1).await?;

    // 2) initialized 通知
    let initialized = serde_json::json!({ "jsonrpc": "2.0", "method": "initialized", "params": {} });
    write_line(&mut stdin, &initialized).await?;

    // 3) 讀帳號即時 rate limits
    let read_req = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "account/rateLimits/read",
        "params": {}
    });
    write_line(&mut stdin, &read_req).await?;
    let response = read_until_id(&mut reader, 2).await?;

    let result = response
        .get("result")
        .ok_or_else(|| anyhow::anyhow!("account/rateLimits/read 回應缺少 result"))?;
    parse_rate_limits_response(result)
    // child 在此 drop，kill_on_drop 會收掉 app-server 進程。
}

// ── JSONL fallback 路徑 ────────────────────────────────────────────────────

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

/// 舊資料源：讀最新 session JSONL 的最後一筆有效 token_count。
/// 已知會漏掉背景（ambient）消耗，僅作為 app-server 取不到時的 fallback。
fn snapshot_from_jsonl() -> anyhow::Result<UsageSnapshot> {
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
                    // 跳過 primary/secondary 為 null 的事件（credits/premium 方案沒有百分比配額）
                    if let Some(ref rl) = payload.rate_limits {
                        if rl.primary.is_some() && rl.secondary.is_some() {
                            token_count_event = Some(event);
                            break;
                        }
                    }
                }
            }
        }
    }

    let event = token_count_event
        .ok_or_else(|| anyhow::anyhow!("No token_count event with rate limits found in latest session log"))?;

    let timestamp = event
        .timestamp
        .ok_or_else(|| anyhow::anyhow!("Codex event timestamp is missing"))?;

    let rate_limits = event
        .payload
        .and_then(|p| p.rate_limits)
        .ok_or_else(|| anyhow::anyhow!("Codex rate limits payload is missing"))?;

    let primary = rate_limits
        .primary
        .ok_or_else(|| anyhow::anyhow!("Codex primary rate limit track is missing"))?;

    let secondary = rate_limits
        .secondary
        .ok_or_else(|| anyhow::anyhow!("Codex secondary rate limit track is missing"))?;

    let session_percent = primary
        .used_percent
        .ok_or_else(|| anyhow::anyhow!("Codex primary used_percent is missing"))?;

    let weekly_percent = secondary
        .used_percent
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

#[async_trait]
impl Provider for CodexProvider {
    async fn snapshot(&self) -> anyhow::Result<UsageSnapshot> {
        // 主路徑：app-server 即時值（含背景消耗），8 秒逾時。
        let codex = find_codex_command();
        match tokio::time::timeout(Duration::from_secs(8), query_app_server(codex)).await {
            Ok(Ok(snapshot)) => return Ok(snapshot),
            Ok(Err(e)) => {
                log::warn!("Codex app-server 取值失敗，改用 JSONL fallback: {}", e);
            }
            Err(_) => {
                log::warn!("Codex app-server 取值逾時，改用 JSONL fallback");
            }
        }

        // Fallback：舊 session JSONL（可能偏舊，但比 Unavailable 好）。
        snapshot_from_jsonl()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_maps_primary_5h_secondary_weekly() {
        // 實測 account/rateLimits/read 回傳格式（primary=5h、secondary=週）
        let result = serde_json::json!({
            "rateLimits": {
                "limitId": "codex",
                "planType": "plus",
                "primary":   { "usedPercent": 2,  "windowDurationMins": 300,   "resetsAt": 1782671414i64 },
                "secondary": { "usedPercent": 24, "windowDurationMins": 10080,  "resetsAt": 1782994735i64 }
            }
        });
        let snap = parse_rate_limits_response(&result).unwrap();
        assert_eq!(snap.provider, ProviderId::Codex);
        assert_eq!(snap.display_name, "Codex");
        assert_eq!(snap.health, Some(ProviderHealth::Available));
        assert_eq!(snap.session_percent, 2.0);
        assert_eq!(snap.weekly_percent, 24.0);
        assert_eq!(snap.session_reset_at.as_ref().unwrap().as_i64(), Some(1782671414));
        assert_eq!(snap.weekly_reset_at.as_ref().unwrap().as_i64(), Some(1782994735));
    }

    #[test]
    fn parse_maps_by_window_duration_not_position() {
        // 故意把週放 primary、5h 放 secondary，仍要依 windowDurationMins 正確對映
        let result = serde_json::json!({
            "rateLimits": {
                "primary":   { "usedPercent": 50, "windowDurationMins": 10080, "resetsAt": 111 },
                "secondary": { "usedPercent": 7,  "windowDurationMins": 300,   "resetsAt": 222 }
            }
        });
        let snap = parse_rate_limits_response(&result).unwrap();
        assert_eq!(snap.session_percent, 7.0);
        assert_eq!(snap.weekly_percent, 50.0);
    }

    #[test]
    fn parse_errors_when_no_windows() {
        let result = serde_json::json!({ "rateLimits": {} });
        assert!(parse_rate_limits_response(&result).is_err());
    }

    #[tokio::test]
    async fn test_codex_provider_live() {
        let provider = CodexProvider::new();
        match provider.snapshot().await {
            Ok(snap) => {
                println!("Live Codex usage retrieved successfully:");
                println!("Session(5h): {}%  (reset: {:?})", snap.session_percent, snap.session_reset_at);
                println!("Weekly: {}%  (reset: {:?})", snap.weekly_percent, snap.weekly_reset_at);
                println!("Health: {:?}", snap.health);
            }
            Err(e) => {
                println!("Failed to retrieve live Codex snapshot: {}", e);
            }
        }
    }
}
