import { execFile } from "node:child_process";
import http from "node:http";
import https from "node:https";

import { extractAntigravityQuota } from "../providers/antigravity";
import type { ProviderUsageSnapshot } from "../shared/usage";

// Antigravity 的額度不落地成檔，只活在執行中 language server 的記憶體。
// 取得方式：掃 process 拿 port + csrf → 打本機唯讀 Connect RPC。
// 唯讀：只查額度，不送 prompt、不消耗額度，不外洩 csrf / PII。
const RPC_BASE = "exa.language_server_pb.LanguageServerService";
// 放寬預算：較慢的機器（尤其他人電腦）首次 PowerShell 冷啟動 + RPC 需要餘裕，
// 否則 IDE 明明開著卻偶發抓不到。IDE 未開時 discovery 仍會快速返回。
const TOTAL_BUDGET_MS = 9000;
const POWERSHELL_TIMEOUT_MS = 6000;
const RPC_TIMEOUT_MS = 2500;
const MAX_BODY_BYTES = 256 * 1024;

export interface ServerCandidate {
  csrf: string;
  ports: number[];
}

type PowerShellRunner = (command: string, timeoutMs: number) => Promise<string>;

interface DiscoveredProcess {
  commandLine?: unknown;
  ports?: unknown;
}

function runPowerShell(command: string, timeoutMs: number): Promise<string> {
  if (timeoutMs <= 0) {
    return Promise.resolve("");
  }

  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", command],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        resolve(error ? "" : stdout || "");
      },
    );
  });
}

const DISCOVERY_COMMAND = `
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
`;

// process、port 與 csrf 在同一個 PowerShell snapshot 內取得，避免逐 PID 冷啟動。
export async function discoverAntigravityServers(
  deadline: number,
  runner: PowerShellRunner = runPowerShell,
): Promise<ServerCandidate[]> {
  const output = await runner(
    DISCOVERY_COMMAND,
    Math.min(POWERSHELL_TIMEOUT_MS, deadline - Date.now()),
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(output || "[]");
  } catch {
    return [];
  }

  const processes = Array.isArray(parsed) ? parsed : [parsed];
  return processes.flatMap((process): ServerCandidate[] => {
    if (!process || typeof process !== "object") {
      return [];
    }

    const { commandLine, ports: rawPorts } = process as DiscoveredProcess;
    if (typeof commandLine !== "string") {
      return [];
    }

    const match = /--csrf_token\s+(\S+)/.exec(commandLine);
    if (!match) {
      return [];
    }

    const ports = (Array.isArray(rawPorts) ? rawPorts : [rawPorts])
      .map((value) =>
        typeof value === "number" ? value : Number.parseInt(String(value), 10),
      )
      .filter((value) => Number.isInteger(value) && value > 0 && value <= 65535);

    return ports.length > 0 ? [{ csrf: match[1], ports }] : [];
  });
}

export function postAntigravityRpc(
  port: number,
  scheme: "http" | "https",
  csrf: string,
  method: string,
  timeoutMs: number,
): Promise<unknown> {
  if (timeoutMs <= 0) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const lib = scheme === "https" ? https : http;
    const request = lib.request(
      {
        host: "127.0.0.1",
        port,
        method: "POST",
        path: `/${RPC_BASE}/${method}`,
        timeout: timeoutMs,
        headers: {
          "Content-Type": "application/json",
          "Connect-Protocol-Version": "1",
          "X-Codeium-Csrf-Token": csrf,
        },
        // 僅對 127.0.0.1 的自簽憑證放行，per-request，不污染全域 TLS。
        ...(scheme === "https" ? { rejectUnauthorized: false } : {}),
      },
      (response) => {
        const status = response.statusCode ?? 0;
        // 不跟隨 redirect、非 2xx 一律視為失敗。
        if (status < 200 || status >= 300) {
          response.resume();
          resolve(null);
          return;
        }

        let received = 0;
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > MAX_BODY_BYTES) {
            request.destroy();
            resolve(null);
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            resolve(null);
          }
        });
      },
    );

    request.on("error", () => resolve(null));
    request.on("timeout", () => {
      request.destroy();
      resolve(null);
    });
    request.end("{}");
  });
}

// 探活：只判斷「是否登入」，不回傳 / 不記錄 name / email / credits。
function isLoggedIn(status: unknown): boolean {
  if (!status || typeof status !== "object") {
    return false;
  }
  const userStatus = (status as { userStatus?: { planStatus?: unknown } })
    .userStatus;
  return Boolean(userStatus && userStatus.planStatus);
}

interface AntigravityServiceDependencies {
  discover?: typeof discoverAntigravityServers;
  rpc?: typeof postAntigravityRpc;
}

export async function readAntigravitySnapshot(
  dependencies: AntigravityServiceDependencies = {},
): Promise<ProviderUsageSnapshot | null> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const discover = dependencies.discover ?? discoverAntigravityServers;
  const rpc = dependencies.rpc ?? postAntigravityRpc;

  let servers: ServerCandidate[];
  try {
    servers = await discover(deadline);
  } catch {
    return null;
  }

  for (const server of servers) {
    for (const port of server.ports) {
      for (const scheme of ["http", "https"] as const) {
        if (deadline - Date.now() <= 0) {
          return null;
        }

        const status = await rpc(
          port,
          scheme,
          server.csrf,
          "GetUserStatus",
          Math.min(RPC_TIMEOUT_MS, deadline - Date.now()),
        );
        if (!isLoggedIn(status)) {
          continue;
        }

        const summary = await rpc(
          port,
          scheme,
          server.csrf,
          "RetrieveUserQuotaSummary",
          Math.min(RPC_TIMEOUT_MS, deadline - Date.now()),
        );
        const snapshot = extractAntigravityQuota(summary, {
          lastUpdated: new Date().toISOString(),
        });
        if (snapshot) {
          return snapshot;
        }
      }
    }
  }

  return null;
}
