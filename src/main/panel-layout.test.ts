import { describe, expect, it } from "vitest";

import { getPanelSize } from "./panel-layout";

describe("getPanelSize", () => {
  it("scales the expanded panel width and measured height together", () => {
    expect(
      getPanelSize({
        mode: "expanded",
        panelScale: 150,
        expandedWindowHeight: 318,
      }),
    ).toEqual({
      width: 564,
      height: 477,
    });
  });

  it("scales the compact panel using its base footprint", () => {
    expect(
      getPanelSize({
        mode: "compact",
        panelScale: 85,
        expandedWindowHeight: 488,
        compactProviderCount: 2,
      }),
    ).toEqual({
      width: 180,
      height: 128,
    });
  });

  it("keeps three providers on one row within the narrow ring footprint", () => {
    expect(
      getPanelSize({
        mode: "compact",
        panelScale: 100,
        expandedWindowHeight: 488,
        compactProviderCount: 3,
      }),
    ).toEqual({
      width: 296,
      height: 150,
    });
  });

  it("sizes the single-provider footprint and clamps out-of-range counts", () => {
    expect(
      getPanelSize({
        mode: "compact",
        panelScale: 100,
        expandedWindowHeight: 488,
        compactProviderCount: 1,
      }),
    ).toEqual({ width: 132, height: 150 });
    // count > 3 clamps down to the three-provider footprint
    expect(
      getPanelSize({
        mode: "compact",
        panelScale: 100,
        expandedWindowHeight: 488,
        compactProviderCount: 5,
      }),
    ).toEqual({ width: 296, height: 150 });
    // count < 1 clamps up to the single-provider footprint
    expect(
      getPanelSize({
        mode: "compact",
        panelScale: 100,
        expandedWindowHeight: 488,
        compactProviderCount: 0,
      }),
    ).toEqual({ width: 132, height: 150 });
  });
});
