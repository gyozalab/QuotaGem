import type { ProviderId, ProviderUsageSnapshot } from "../shared/usage";

export interface ProviderReader {
  provider: ProviderId;
  displayName: string;
  read: () => Promise<ProviderUsageSnapshot | null>;
}

function createUnavailableSnapshot(
  provider: ProviderId,
  displayName: string,
): ProviderUsageSnapshot {
  return {
    provider,
    displayName,
    sessionPercent: 0,
    sessionResetAt: null,
    weeklyPercent: 0,
    weeklyResetAt: null,
    lastUpdated: "",
    health: "unavailable",
  };
}

export async function loadProviderSnapshots(
  readers: ProviderReader[],
): Promise<ProviderUsageSnapshot[]> {
  const settled = await Promise.allSettled(
    readers.map(async (reader) => ({
      reader,
      snapshot: await reader.read(),
    })),
  );

  return settled.map((result, index) => {
    const reader = readers[index];

    if (result.status === "fulfilled" && result.value.snapshot) {
      return result.value.snapshot;
    }

    return createUnavailableSnapshot(reader.provider, reader.displayName);
  });
}
