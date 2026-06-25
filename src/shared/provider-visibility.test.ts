import { describe, expect, it } from "vitest";

import type { NormalizedProviderUsage } from "./usage";
import { filterProvidersByVisibility } from "./provider-visibility";

const providers: NormalizedProviderUsage[] = [
  {
    provider: "claude",
    displayName: "Claude",
    health: "available",
    session: {
      label: "Session",
      percent: 42,
      displayPercent: 42,
      percentLabel: "42%",
      barMode: "used",
      resetLabel: "Soon",
      level: "normal",
    },
    weekly: {
      label: "Weekly",
      percent: 58,
      displayPercent: 58,
      percentLabel: "58%",
      barMode: "used",
      resetLabel: "Later",
      level: "normal",
    },
    lastUpdated: "2026-03-30T01:00:00.000Z",
  },
  {
    provider: "codex",
    displayName: "Codex",
    health: "available",
    session: {
      label: "Session",
      percent: 12,
      displayPercent: 12,
      percentLabel: "12%",
      barMode: "used",
      resetLabel: "Soon",
      level: "normal",
    },
    weekly: {
      label: "Weekly",
      percent: 26,
      displayPercent: 26,
      percentLabel: "26%",
      barMode: "used",
      resetLabel: "Later",
      level: "normal",
    },
    lastUpdated: "2026-03-30T01:00:00.000Z",
  },
  {
    provider: "agy",
    displayName: "Agy",
    health: "available",
    session: {
      label: "Session",
      percent: 8,
      displayPercent: 8,
      percentLabel: "8%",
      barMode: "used",
      resetLabel: "Soon",
      level: "normal",
    },
    weekly: {
      label: "Weekly",
      percent: 16,
      displayPercent: 16,
      percentLabel: "16%",
      barMode: "used",
      resetLabel: "Later",
      level: "normal",
    },
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

  it("returns only Antigravity when visibility is agy", () => {
    expect(filterProvidersByVisibility(providers, "agy")).toEqual([providers[2]]);
  });
});
