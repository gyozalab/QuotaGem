import type { ProviderVisibility } from "./dashboard";
import type { NormalizedProviderUsage, ProviderId } from "./usage";

export const DEFAULT_PROVIDER_VISIBILITY: ProviderVisibility = {
  claude: true,
  codex: true,
  antigravity: true,
};

// 讀取邊界相容轉換：吃舊字串("both"/"claude"/"codex")或新 map，回正規 map。
// 取代不存在的 electron-store migration——舊使用者磁碟上的字串在此被升級。
export function coerceProviderVisibility(raw: unknown): ProviderVisibility {
  if (raw === "both") {
    return { claude: true, codex: true, antigravity: true };
  }
  if (raw === "claude") {
    return { claude: true, codex: false, antigravity: false };
  }
  if (raw === "codex") {
    return { claude: false, codex: true, antigravity: false };
  }
  if (raw && typeof raw === "object") {
    const value = raw as Partial<Record<ProviderId, unknown>>;
    return {
      claude: value.claude !== false,
      codex: value.codex !== false,
      antigravity: value.antigravity !== false,
    };
  }
  return { ...DEFAULT_PROVIDER_VISIBILITY };
}

export function filterProvidersByVisibility(
  providers: NormalizedProviderUsage[],
  visibility: ProviderVisibility,
): NormalizedProviderUsage[] {
  return providers.filter((provider) => visibility[provider.provider] !== false);
}
