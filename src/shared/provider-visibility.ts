import type { ProviderVisibility } from "./dashboard";
import type { NormalizedProviderUsage } from "./usage";

export function filterProvidersByVisibility(
  providers: NormalizedProviderUsage[],
  visibility: ProviderVisibility,
): NormalizedProviderUsage[] {
  if (visibility === "both" || visibility === "all") {
    return providers;
  }

  return providers.filter((provider) => provider.provider === visibility);
}
