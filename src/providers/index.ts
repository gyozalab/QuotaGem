import type { ProviderId, ProviderUsageSnapshot } from "../shared/usage";

export interface ProviderReader {
  provider: ProviderId;
  displayName: string;
  read: () => Promise<ProviderUsageSnapshot | null>;
}

interface LoadProviderSnapshotsOptions {
  timeoutMsByProvider?: Partial<Record<ProviderId, number>>;
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
  options: LoadProviderSnapshotsOptions = {},
): Promise<ProviderUsageSnapshot[]> {
  const settled = await Promise.allSettled(
    readers.map(async (reader) => {
      const timeoutMs = options.timeoutMsByProvider?.[reader.provider];

      return {
        reader,
        snapshot: await readWithOptionalTimeout(reader, timeoutMs),
      };
    }),
  );

  return settled.map((result, index) => {
    const reader = readers[index];

    if (result.status === "fulfilled" && result.value.snapshot) {
      return result.value.snapshot;
    }

    if (result.status === "rejected") {
      const reason =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      console.warn(
        `【Provider读取】读取失败：provider=${reader.provider}, reason=${reason}`,
      );
    }

    return createUnavailableSnapshot(reader.provider, reader.displayName);
  });
}

async function readWithOptionalTimeout(
  reader: ProviderReader,
  timeoutMs?: number,
): Promise<ProviderUsageSnapshot | null> {
  if (!timeoutMs || timeoutMs <= 0) {
    return reader.read();
  }

  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      reader.read(),
      new Promise<null>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(
            new Error(`TimedOut after ${timeoutMs}ms`),
          );
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("TimedOut after ")
    ) {
      console.warn(
        `【Provider读取】读取超时：provider=${reader.provider}, timeoutMs=${timeoutMs}`,
      );
      return null;
    }

    throw error;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
