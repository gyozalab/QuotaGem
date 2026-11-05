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

// ── 直打 backend-api 主路徑：讀 ~/.codex/auth.json，單次 HTTPS 拿 rate limit ──
// 對照 app-server 路徑（spawn 整個 codex 當常駐 server，約 142MB），這條只發一個
// GET /wham/usage，零常駐行程。token 過期（非 2xx）時自動退回 app-server，由 codex
// CLI 幫忙 refresh，因此穩態下維持零常駐。

#[derive(Deserialize, Debug)]
struct CodexAuthTokens {
    access_token: Option<String>,
    account_id: Option<String>,
}

#[derive(Deserialize, Debug)]
struct CodexAuthFile {
    tokens: Option<CodexAuthTokens>,
}

/// 解析 `GET /backend-api/wham/usage` 回應，產出 UsageSnapshot。純函式，方便 fixture 測試。
fn parse_wham_usage(body: &serde_json::Value) -> anyhow::Result<UsageSnapshot> {
    let rate_limit = body
        .get("rate_limit")
        .ok_or_else(|| anyhow::anyhow!("/wham/usage 回應缺少 rate_limit"))?;

    let mut session_percent = 0.0_f64;
    let mut session_reset_at: Option<serde_json::Value> = None;
    let mut weekly_percent = 0.0_f64;
    let mut weekly_reset_at: Option<serde_json::Value> = None;
    let mut found = false;

    // primary_window / secondary_window 哪個是 5h、哪個是週，依 limit_window_seconds 判斷。
    for key in ["primary_window", "secondary_window"] {
        let window = match rate_limit.get(key) {
            Some(w) if !w.is_null() => w,
            _ => continue,
        };
        let used = match window.get("used_percent").and_then(|v| v.as_f64()) {
            Some(u) => u,
            None => continue,
        };
        let dur_secs = window
            .get("limit_window_seconds")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        let reset = window.get("reset_at").cloned();
        found = true;
        if dur_secs <= 21600 {
            // <= 6 小時 → 5 小時視窗
            session_percent = used;
            session_reset_at = reset;
        } else {
            // 週視窗
            weekly_percent = used;
            weekly_reset_at = reset;
        }
    }

    if !found {
        return Err(anyhow::anyhow!("/wham/usage 沒有可用的視窗資料"));
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

/// 讀 ~/.codex/auth.json 的 access_token / account_id，直打 backend-api 拿 rate limit。
async fn query_http_usage() -> anyhow::Result<UsageSnapshot> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map(PathBuf::from)
        .map_err(|_| anyhow::anyhow!("找不到家目錄"))?;
    let auth_path = home.join(".codex").join("auth.json");
    let content = std::fs::read_to_string(&auth_path)
        .map_err(|e| anyhow::anyhow!("讀取 ~/.codex/auth.json 失敗: {}", e))?;
    let auth: CodexAuthFile = serde_json::from_str(&content)?;
    let tokens = auth
        .tokens
        .ok_or_else(|| anyhow::anyhow!("auth.json 缺少 tokens"))?;
    let access_token = tokens
        .access_token
        .filter(|s| !s.is_empty())
        .ok_or_else(|| anyhow::anyhow!("auth.json 缺少 access_token"))?;
    let account_id = tokens.account_id.unwrap_or_default();

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .unwrap_or_default();
    let mut req = client
        .get("https://chatgpt.com/backend-api/wham/usage")
        .header("Authorization", format!("Bearer {}", access_token));
    if !account_id.is_empty() {
        req = req.header("ChatGPT-Account-Id", account_id);
    }

    let res = req.send().await?;
    let status = res.status();
    if !status.is_success() {
        return Err(anyhow::anyhow!("/wham/usage 回應狀態 {}", status));
    }
    let body: serde_json::Value = res.json().await?;
    parse_wham_usage(&body)
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
        // 主路徑：直打 backend-api /wham/usage（單次 HTTPS，零常駐行程），10 秒逾時。
        match tokio::time::timeout(Duration::from_secs(10), query_http_usage()).await {
            Ok(Ok(snapshot)) => return Ok(snapshot),
            Ok(Err(e)) => {
                log::warn!("Codex 直打 /wham/usage 失敗，改用 app-server: {}", e);
            }
            Err(_) => {
                log::warn!("Codex 直打 /wham/usage 逾時，改用 app-server");
            }
        }

        // Fallback 1：app-server 即時值（會自動 refresh token），8 秒逾時。
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

        // Fallback 2：舊 session JSONL（可能偏舊，但比 Unavailable 好）。
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

    #[test]
    fn parse_wham_maps_windows_by_duration() {
        // GET /wham/usage 實測結構：primary_window=5h、secondary_window=週
        let body = serde_json::json!({
            "plan_type": "plus",
            "rate_limit": {
                "primary_window":   { "used_percent": 83, "limit_window_seconds": 18000,  "reset_at": 1782671414i64 },
                "secondary_window": { "used_percent": 13, "limit_window_seconds": 604800, "reset_at": 1782994735i64 }
            }
        });
        let snap = parse_wham_usage(&body).unwrap();
        assert_eq!(snap.provider, ProviderId::Codex);
        assert_eq!(snap.session_percent, 83.0);
        assert_eq!(snap.weekly_percent, 13.0);
        assert_eq!(snap.session_reset_at.as_ref().unwrap().as_i64(), Some(1782671414));
        assert_eq!(snap.weekly_reset_at.as_ref().unwrap().as_i64(), Some(1782994735));
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
