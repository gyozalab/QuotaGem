use crate::models::{UsageSnapshot, ProviderId, ProviderHealth, ProviderUsageGroup};
use crate::provider::Provider;
use async_trait::async_trait;
use std::time::Duration;
use chrono::Utc;
use serde::Deserialize;

/// 探測到的候選程序。欄位沿用舊 PowerShell 腳本輸出的 JSON 形狀（ports 是數字陣列），
/// 讓 `snapshot()` 後段的 `extract_csrf`／`extract_ports`／`post_rpc` 流程不用改。
#[derive(Debug)]
struct DiscoveredProcess {
    _process_id: u32,
    command_line: Option<String>,
    ports: Option<serde_json::Value>,
}

/// 候選程序判斷，比照舊腳本：命令列含 `--csrf_token`（IDE 的 language server），
/// 或名稱是 `agy.exe`／`language_server.exe`。PowerShell 的 `-match`／`-eq` 不分大小寫，這裡也一樣。
fn is_antigravity_candidate(name: &str, command_line: &str) -> bool {
    name.eq_ignore_ascii_case("agy.exe")
        || name.eq_ignore_ascii_case("language_server.exe")
        || command_line.to_ascii_lowercase().contains("--csrf_token")
}

/// 依 PID 把監聽表配給候選程序。同一個連接埠常在 IPv4 與 IPv6 各監聽一次，去重後只打一次 RPC。
fn pair_ports(candidates: Vec<(u32, String)>, listeners: &[(u32, u16)]) -> Vec<DiscoveredProcess> {
    candidates
        .into_iter()
        .map(|(pid, command_line)| {
            let mut ports: Vec<u16> = listeners
                .iter()
                .filter(|(owner, _)| *owner == pid)
                .map(|(_, port)| *port)
                .collect();
            ports.sort_unstable();
            ports.dedup();
            DiscoveredProcess {
                _process_id: pid,
                command_line: Some(command_line),
                ports: Some(serde_json::Value::from(ports)),
            }
        })
        .collect()
}

/// MIB TCP 表的 `dwLocalPort` 只有低 16 位有效，而且是網路位元組序（big-endian）。
fn port_from_network_order(raw: u32) -> u16 {
    u16::from_be((raw & 0xFFFF) as u16)
}

/// 同步探測：sysinfo 列程序找候選，有找到才用 GetExtendedTcpTable 查監聽連接埠。
/// 取代原本每輪 spawn powershell.exe（PowerShell 卡死時 QuotaGem 會跟著卡、還會一直堆程序）。
#[cfg(windows)]
fn discover_processes() -> anyhow::Result<Vec<DiscoveredProcess>> {
    use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

    let mut sys = System::new();
    sys.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing().with_cmd(UpdateKind::Always),
    );

    let own_pid = std::process::id();
    let candidates: Vec<(u32, String)> = sys
        .processes()
        .values()
        .filter(|p| p.pid().as_u32() != own_pid)
        .filter_map(|p| {
            let command_line = p
                .cmd()
                .iter()
                .map(|arg| arg.to_string_lossy())
                .collect::<Vec<_>>()
                .join(" ");
            is_antigravity_candidate(&p.name().to_string_lossy(), &command_line)
                .then(|| (p.pid().as_u32(), command_line))
        })
        .collect();

    // 沒找到候選程序就不查連接埠，跟舊腳本一樣。
    if candidates.is_empty() {
        return Ok(Vec::new());
    }

    Ok(pair_ports(candidates, &tcp_listeners()?))
}

#[cfg(not(windows))]
fn discover_processes() -> anyhow::Result<Vec<DiscoveredProcess>> {
    Err(anyhow::anyhow!("Antigravity discovery is only supported on Windows"))
}

/// 列出 IPv4 與 IPv6 所有 LISTEN 狀態的 (PID, 本機連接埠)。
/// 單一位址族失敗只記 log，另一個照用；兩個都失敗才回錯。
#[cfg(windows)]
fn tcp_listeners() -> anyhow::Result<Vec<(u32, u16)>> {
    use windows_sys::Win32::NetworkManagement::IpHelper::{
        MIB_TCP6ROW_OWNER_PID, MIB_TCP6TABLE_OWNER_PID, MIB_TCPROW_OWNER_PID, MIB_TCPTABLE_OWNER_PID,
    };
    use windows_sys::Win32::Networking::WinSock::{AF_INET, AF_INET6};

    let ipv4 = read_tcp_table(AF_INET).map(|buf| {
        // SAFETY: buf 由 read_tcp_table 以 AF_INET 填入，版面就是 MIB_TCPTABLE_OWNER_PID。
        unsafe {
            table_rows::<MIB_TCPROW_OWNER_PID>(
                &buf,
                std::mem::offset_of!(MIB_TCPTABLE_OWNER_PID, table),
            )
        }
        .iter()
        .map(|row| (row.dwOwningPid, port_from_network_order(row.dwLocalPort)))
        .collect::<Vec<_>>()
    });
    let ipv6 = read_tcp_table(AF_INET6).map(|buf| {
        // SAFETY: buf 由 read_tcp_table 以 AF_INET6 填入，版面就是 MIB_TCP6TABLE_OWNER_PID。
        unsafe {
            table_rows::<MIB_TCP6ROW_OWNER_PID>(
                &buf,
                std::mem::offset_of!(MIB_TCP6TABLE_OWNER_PID, table),
            )
        }
        .iter()
        .map(|row| (row.dwOwningPid, port_from_network_order(row.dwLocalPort)))
        .collect::<Vec<_>>()
    });

    match (ipv4, ipv6) {
        (Err(v4), Err(v6)) => Err(anyhow::anyhow!("TCP listener tables unavailable: IPv4: {:#}; IPv6: {:#}", v4, v6)),
        (v4, v6) => {
            let mut listeners = Vec::new();
            for (family, result) in [("IPv4", v4), ("IPv6", v6)] {
                match result {
                    Ok(rows) => listeners.extend(rows),
                    Err(e) => log::warn!("Antigravity {} listener table unavailable: {:#}", family, e),
                }
            }
            Ok(listeners)
        }
    }
}

/// 呼叫 GetExtendedTcpTable（TCP_TABLE_OWNER_PID_LISTENER）取回整張表的原始緩衝區。
/// 先問大小再配置；兩次呼叫之間表變大會再回 ERROR_INSUFFICIENT_BUFFER，重試幾次即可。
/// 用 `Vec<u64>` 當底層確保對齊（表內欄位最大是 u32）。
#[cfg(windows)]
fn read_tcp_table(family: u16) -> anyhow::Result<Vec<u64>> {
    use windows_sys::Win32::Foundation::{ERROR_INSUFFICIENT_BUFFER, FALSE, NO_ERROR};
    use windows_sys::Win32::NetworkManagement::IpHelper::{GetExtendedTcpTable, TCP_TABLE_OWNER_PID_LISTENER};

    let mut buf: Vec<u64> = Vec::new();
    let mut size: u32 = 0;
    for _ in 0..4 {
        let ptr = if buf.is_empty() { std::ptr::null_mut() } else { buf.as_mut_ptr().cast() };
        // SAFETY: ptr 為 null（只問大小）或指向至少 size 位元組的緩衝區。
        let ret = unsafe {
            GetExtendedTcpTable(ptr, &mut size, FALSE, u32::from(family), TCP_TABLE_OWNER_PID_LISTENER, 0)
        };
        match ret {
            NO_ERROR => return Ok(buf),
            ERROR_INSUFFICIENT_BUFFER => buf = vec![0u64; (size as usize).div_ceil(8)],
            code => return Err(anyhow::anyhow!("GetExtendedTcpTable(af={}) failed with code {}", family, code)),
        }
    }
    Err(anyhow::anyhow!("GetExtendedTcpTable(af={}) kept growing between calls", family))
}

/// 把 MIB_TCP*TABLE_OWNER_PID 緩衝區切成 row slice。筆數以緩衝區實際容量為上限，避免越界。
///
/// # Safety
/// `buf` 必須是 GetExtendedTcpTable 填好、版面為「u32 筆數 + 從 `rows_offset` 起的 `Row` 陣列」的表。
#[cfg(windows)]
unsafe fn table_rows<Row>(buf: &[u64], rows_offset: usize) -> &[Row] {
    let bytes = std::mem::size_of_val(buf);
    if bytes < rows_offset {
        return &[];
    }
    let base = buf.as_ptr().cast::<u8>();
    let declared = base.cast::<u32>().read() as usize;
    let capacity = (bytes - rows_offset) / std::mem::size_of::<Row>();
    std::slice::from_raw_parts(base.add(rows_offset).cast::<Row>(), declared.min(capacity))
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
        let mut req = self.client.post(&url)
            .header("Content-Type", "application/json")
            .header("Connect-Protocol-Version", "1");
        // IDE 的 language_server.exe 會用 --csrf_token 開 server 並要求此 header；
        // agy CLI 自帶的 loopback server 不帶 csrf、也不驗此 header，故 csrf 為空時省略。
        if !csrf.is_empty() {
            req = req.header("X-Codeium-Csrf-Token", csrf);
        }
        let res = req
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
        // 列程序與讀 TCP 表都是同步系統呼叫，丟到 blocking 執行緒，不卡 async runtime。
        let processes = tokio::task::spawn_blocking(discover_processes)
            .await
            .map_err(|e| anyhow::anyhow!("Antigravity discovery task failed: {}", e))??;

        for proc in processes {
            let cmd_line = match proc.command_line {
                Some(ref c) if !c.is_empty() => c,
                _ => continue,
            };

            // IDE 端從命令列的 --csrf_token 取得；agy CLI 端沒有此旗標，csrf 留空即可（server 不驗）。
            let csrf = extract_csrf(cmd_line).unwrap_or_default();

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
    fn candidate_matches_csrf_token_in_command_line() {
        let ide_cmd = r"C:\Users\me\AppData\Local\Programs\Antigravity\resources\app\extensions\antigravity\bin\language_server_windows_x64.exe --enable_lsp --csrf_token 1f2e3d4c-aaaa-bbbb-cccc-0123456789ab --extension_server_port 52100";
        assert!(is_antigravity_candidate("language_server_windows_x64.exe", ide_cmd));
        // PowerShell 的 -match 不分大小寫
        assert!(is_antigravity_candidate("whatever.exe", "foo --CSRF_TOKEN abc"));
    }

    #[test]
    fn candidate_matches_agy_and_language_server_by_name() {
        assert!(is_antigravity_candidate("agy.exe", r"C:\tools\agy.exe"));
        assert!(is_antigravity_candidate("AGY.EXE", ""));
        assert!(is_antigravity_candidate("language_server.exe", "language_server.exe --port 1234"));
        assert!(is_antigravity_candidate("Language_Server.exe", ""));
    }

    #[test]
    fn candidate_rejects_unrelated_processes() {
        assert!(!is_antigravity_candidate("Code.exe", r"C:\VSCode\Code.exe --type=renderer"));
        assert!(!is_antigravity_candidate("agy.exe.bak", ""));
        assert!(!is_antigravity_candidate("language_server_windows_x64.exe", "language_server_windows_x64.exe --enable_lsp"));
        assert!(!is_antigravity_candidate("myagy.exe", "--csrf"));
    }

    #[test]
    fn pair_ports_assigns_listeners_by_pid() {
        let candidates = vec![
            (100, "agy.exe".to_string()),
            (200, "language_server.exe --csrf_token t".to_string()),
            (300, "agy.exe --no-server".to_string()),
        ];
        let listeners = [(100, 52100), (999, 8080), (200, 42001), (200, 42000), (4, 445)];

        let paired = pair_ports(candidates, &listeners);
        assert_eq!(paired.len(), 3);

        assert_eq!(paired[0]._process_id, 100);
        assert_eq!(paired[0].command_line.as_deref(), Some("agy.exe"));
        assert_eq!(extract_ports(paired[0].ports.as_ref().unwrap()), vec![52100]);

        assert_eq!(paired[1]._process_id, 200);
        assert_eq!(extract_ports(paired[1].ports.as_ref().unwrap()), vec![42000, 42001]);

        // 沒有監聽的程序仍保留（ports 為空陣列），交給下游跳過
        assert_eq!(paired[2]._process_id, 300);
        assert!(extract_ports(paired[2].ports.as_ref().unwrap()).is_empty());
    }

    #[test]
    fn pair_ports_dedups_same_port_on_ipv4_and_ipv6() {
        let paired = pair_ports(vec![(7, "agy.exe".to_string())], &[(7, 52100), (7, 52100), (7, 52101)]);
        assert_eq!(extract_ports(paired[0].ports.as_ref().unwrap()), vec![52100, 52101]);
    }

    #[test]
    fn port_from_network_order_reads_low_16_bits_big_endian() {
        assert_eq!(port_from_network_order(u32::from(52100u16.to_be())), 52100);
        assert_eq!(port_from_network_order(u32::from(443u16.to_be())), 443);
        // 高 16 位是垃圾也不影響
        assert_eq!(port_from_network_order(0xDEAD_0000 | u32::from(8080u16.to_be())), 8080);
    }

    /// 真機探測：開一個監聽 socket，確認 GetExtendedTcpTable 讀得到本程序的 PID 與連接埠（IPv4、IPv6 各一）。
    #[cfg(windows)]
    #[test]
    fn tcp_listeners_reports_own_listening_ports() {
        let v4 = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let v4_port = v4.local_addr().unwrap().port();
        let v6 = std::net::TcpListener::bind("[::1]:0").ok();
        let pid = std::process::id();

        let listeners = tcp_listeners().unwrap();
        assert!(listeners.contains(&(pid, v4_port)), "IPv4 port {} not found for pid {}", v4_port, pid);
        if let Some(v6) = v6 {
            let v6_port = v6.local_addr().unwrap().port();
            assert!(listeners.contains(&(pid, v6_port)), "IPv6 port {} not found for pid {}", v6_port, pid);
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
