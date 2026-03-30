import type { ProviderUsageSnapshot } from "../shared/usage";

describe("loadProviderSnapshots", () => {
  it("returns the successful provider even when another provider fails", async () => {
    const providersModule = await import("./index");
    const loadProviderSnapshots = Reflect.get(
      providersModule,
      "loadProviderSnapshots",
    );

    expect(typeof loadProviderSnapshots).toBe("function");

    if (typeof loadProviderSnapshots !== "function") {
      return;
    }

    const codexSnapshot: ProviderUsageSnapshot = {
      provider: "codex",
      displayName: "Codex",
      sessionPercent: 42,
      sessionResetAt: "2026-03-28T03:00:00.000Z",
      weeklyPercent: 18,
      weeklyResetAt: "2026-04-03T03:00:00.000Z",
      lastUpdated: "2026-03-28T03:00:00.000Z",
      health: "available",
    };

    const snapshots = await loadProviderSnapshots([
      {
        provider: "codex",
        displayName: "Codex",
        read: async () => codexSnapshot,
      },
      {
        provider: "claude",
        displayName: "Claude",
        read: async () => {
          throw new Error("SessionExpired");
        },
      },
    ]);

    expect(snapshots).toEqual([
      codexSnapshot,
      {
        provider: "claude",
        displayName: "Claude",
        sessionPercent: 0,
        sessionResetAt: null,
        weeklyPercent: 0,
        weeklyResetAt: null,
        lastUpdated: "",
        health: "unavailable",
      },
    ]);
  });
});
