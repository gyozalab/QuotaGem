import { describe, expect, it } from "vitest";

import type { NormalizedProviderUsage } from "./usage";
import {
  coerceProviderVisibility,
  filterProvidersByVisibility,
} from "./provider-visibility";

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
  {
    provider: "antigravity",
    displayName: "Antigravity",
    health: "available",
    session: { label: "Session", percent: 1, resetLabel: "Soon", level: "normal" },
    weekly: { label: "Weekly", percent: 4, resetLabel: "Later", level: "normal" },
    lastUpdated: "2026-03-30T01:00:00.000Z",
  },
];

describe("filterProvidersByVisibility", () => {
  it("keeps all providers when all visible", () => {
    expect(
      filterProvidersByVisibility(providers, {
        claude: true,
        codex: true,
        antigravity: true,
      }),
    ).toEqual(providers);
  });

  it("hides providers whose flag is false", () => {
    expect(
      filterProvidersByVisibility(providers, {
        claude: true,
        codex: false,
        antigravity: false,
      }),
    ).toEqual([providers[0]]);
  });

  it("treats a missing flag as visible", () => {
    expect(
      filterProvidersByVisibility(
        providers,
        { claude: false, codex: true } as unknown as Parameters<
          typeof filterProvidersByVisibility
        >[1],
      ),
    ).toEqual([providers[1], providers[2]]);
  });
});

describe("coerceProviderVisibility", () => {
  it("maps legacy 'both' to all visible", () => {
    expect(coerceProviderVisibility("both")).toEqual({
      claude: true,
      codex: true,
      antigravity: true,
    });
  });

  it("maps legacy 'claude' to claude-only", () => {
    expect(coerceProviderVisibility("claude")).toEqual({
      claude: true,
      codex: false,
      antigravity: false,
    });
  });

  it("passes through a map, defaulting missing keys to visible", () => {
    expect(coerceProviderVisibility({ codex: false })).toEqual({
      claude: true,
      codex: false,
      antigravity: true,
    });
  });

  it("defaults unknown input to all visible", () => {
    expect(coerceProviderVisibility(undefined)).toEqual({
      claude: true,
      codex: true,
      antigravity: true,
    });
  });
});
