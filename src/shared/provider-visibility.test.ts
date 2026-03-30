import { describe, expect, it } from "vitest";

import type { NormalizedProviderUsage } from "./usage";
import { filterProvidersByVisibility } from "./provider-visibility";

const providers: NormalizedProviderUsage[] = [
  {
    provider: "claude",
    displayName: "Claude",
    health: "available",
    session: { label: "Session", percent: 42, resetLabel: "Soon", level: "normal" },
    weekly: { label: "Weekly", percent: 58, resetLabel: "Later", level: "normal" },
    lastUpdated: "2026-03-30T01:00:00.000Z",
  },
  {
    provider: "codex",
    displayName: "Codex",
    health: "available",
    session: { label: "Session", percent: 12, resetLabel: "Soon", level: "normal" },
    weekly: { label: "Weekly", percent: 26, resetLabel: "Later", level: "normal" },
    lastUpdated: "2026-03-30T01:00:00.000Z",
  },
];

describe("filterProvidersByVisibility", () => {
  it("keeps both providers when visibility is both", () => {
    expect(filterProvidersByVisibility(providers, "both")).toEqual(providers);
  });

  it("returns only Claude when visibility is claude", () => {
    expect(filterProvidersByVisibility(providers, "claude")).toEqual([providers[0]]);
  });

  it("returns only Codex when visibility is codex", () => {
    expect(filterProvidersByVisibility(providers, "codex")).toEqual([providers[1]]);
  });
});
