use chrono::Utc;
use serde::Serialize;
use std::sync::Mutex;
use std::time::Instant;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemMetric {
  pub id: &'static str,
  pub label: &'static str,
  pub percent: Option<f64>,
  pub readout: String,
  pub available: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemState {
  pub metrics: Vec<SystemMetric>,
  pub last_updated: String,
}

#[derive(Debug, Clone, Copy)]
struct NetSample {
  bytes: u64,
  at: Instant,
}

#[derive(Debug, Default)]
pub struct SystemSampler {
  last_net: Mutex<Option<NetSample>>,
}

impl SystemSampler {
  pub fn snapshot(&self) -> SystemState {
    let cpu_percent = read_cpu_percent();
    let ram_percent = read_ram_percent();
    let gpu_percent = read_gpu_percent();
    let net_readout = self.read_net_rate();
    let net_available = net_readout.is_some();

    SystemState {
      metrics: vec![
        percent_metric("cpu", "CPU", cpu_percent),
        percent_metric("gpu", "GPU", gpu_percent),
        percent_metric("ram", "RAM", ram_percent),
        SystemMetric {
          id: "net",
          label: "NET",
          percent: None,
          readout: net_readout.unwrap_or_else(|| "—".to_string()),
          available: net_available,
        },
      ],
      last_updated: Utc::now().to_rfc3339(),
    }
  }

  fn read_net_rate(&self) -> Option<String> {
    let bytes = read_net_bytes()?;
    let now = Instant::now();
    let mut guard = self.last_net.lock().ok()?;
    let previous = *guard;
    *guard = Some(NetSample { bytes, at: now });

    let previous = previous?;
    let elapsed = now.duration_since(previous.at).as_secs_f64();
    if elapsed <= 0.0 || bytes < previous.bytes {
      return None;
    }

    Some(format_bytes_per_second(
      (bytes - previous.bytes) as f64 / elapsed,
    ))
  }
}

fn percent_metric(id: &'static str, label: &'static str, percent: Option<f64>) -> SystemMetric {
  SystemMetric {
    id,
    label,
    percent,
    readout: percent
      .map(|value| format!("{}%", value.round() as u32))
      .unwrap_or_else(|| "—".to_string()),
    available: percent.is_some(),
  }
}

#[cfg(target_os = "macos")]
fn command_output(program: &str, args: &[&str]) -> Option<String> {
  let output = std::process::Command::new(program).args(args).output().ok()?;
  if !output.status.success() {
    return None;
  }
  Some(String::from_utf8_lossy(&output.stdout).to_string())
}

#[cfg(target_os = "macos")]
fn read_cpu_percent() -> Option<f64> {
  let output = command_output("top", &["-l", "1", "-n", "0"])?;
  let line = output.lines().find(|line| line.contains("CPU usage:"))?;
  let idle_part = line.split(',').find(|part| part.contains("idle"))?;
  let idle = idle_part
    .split('%')
    .next()?
    .split_whitespace()
    .last()?
    .parse::<f64>()
    .ok()?;
  Some((100.0 - idle).clamp(0.0, 100.0))
}

#[cfg(not(target_os = "macos"))]
fn read_cpu_percent() -> Option<f64> {
  None
}

#[cfg(target_os = "macos")]
fn read_ram_percent() -> Option<f64> {
  let total = command_output("sysctl", &["-n", "hw.memsize"])?
    .trim()
    .parse::<f64>()
    .ok()?;
  let vm_stat = command_output("vm_stat", &[])?;
  let page_size = parse_vm_stat_number(
    vm_stat
      .lines()
      .find(|line| line.contains("page size of"))?,
  )?;
  let free_pages = parse_named_vm_stat(&vm_stat, "Pages free")?;
  let speculative_pages = parse_named_vm_stat(&vm_stat, "Pages speculative").unwrap_or(0.0);
  let free_bytes = (free_pages + speculative_pages) * page_size;
  Some(((total - free_bytes) / total * 100.0).clamp(0.0, 100.0))
}

#[cfg(not(target_os = "macos"))]
fn read_ram_percent() -> Option<f64> {
  None
}

#[cfg(target_os = "macos")]
fn parse_named_vm_stat(output: &str, name: &str) -> Option<f64> {
  let line = output.lines().find(|line| line.trim_start().starts_with(name))?;
  parse_vm_stat_number(line)
}

#[cfg(target_os = "macos")]
fn parse_vm_stat_number(line: &str) -> Option<f64> {
  let digits: String = line
    .chars()
    .filter(|ch| ch.is_ascii_digit())
    .collect();
  digits.parse::<f64>().ok()
}

#[cfg(target_os = "macos")]
fn read_gpu_percent() -> Option<f64> {
  let output = command_output("ioreg", &["-r", "-c", "IOAccelerator", "-d", "1"])?;
  let marker = "\"Device Utilization %\"=";
  let idx = output.find(marker)?;
  let after = &output[idx + marker.len()..];
  let digits: String = after
    .chars()
    .take_while(|ch| ch.is_ascii_digit() || *ch == '.')
    .collect();
  digits.parse::<f64>().ok().map(|value| value.clamp(0.0, 100.0))
}

#[cfg(not(target_os = "macos"))]
fn read_gpu_percent() -> Option<f64> {
  None
}

#[cfg(target_os = "macos")]
fn read_net_bytes() -> Option<u64> {
  let output = command_output("netstat", &["-ibn"])?;
  let mut total = 0_u64;
  for line in output.lines().skip(1) {
    let columns: Vec<&str> = line.split_whitespace().collect();
    if columns.len() < 10 || !columns[2].starts_with("<Link#") {
      continue;
    }
    let name = columns[0];
    if name == "lo0"
      || name.starts_with("utun")
      || name.starts_with("awdl")
      || name.starts_with("llw")
      || name.ends_with('*')
    {
      continue;
    }
    let ibytes = columns[6].parse::<u64>().ok().unwrap_or(0);
    let obytes = columns[9].parse::<u64>().ok().unwrap_or(0);
    total = total.saturating_add(ibytes).saturating_add(obytes);
  }
  (total > 0).then_some(total)
}

#[cfg(not(target_os = "macos"))]
fn read_net_bytes() -> Option<u64> {
  None
}

fn format_bytes_per_second(bytes: f64) -> String {
  if bytes >= 1_000_000.0 {
    format!("{:.1}M/s", bytes / 1_000_000.0)
  } else if bytes >= 1_000.0 {
    format!("{:.0}k/s", bytes / 1_000.0)
  } else {
    format!("{:.0}B/s", bytes)
  }
}

#[cfg(test)]
mod tests {
  use super::format_bytes_per_second;

  #[test]
  fn formats_network_rates_for_menu_bar_space() {
    assert_eq!(format_bytes_per_second(96_200.0), "96k/s");
    assert_eq!(format_bytes_per_second(2_450_000.0), "2.5M/s");
    assert_eq!(format_bytes_per_second(640.0), "640B/s");
  }
}
