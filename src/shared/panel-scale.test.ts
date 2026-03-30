import { describe, expect, it } from "vitest";

import {
  getPanelScaleFromSliderIndex,
  getPanelScaleFactor,
  getPanelScaleSliderIndex,
  normalizePanelScale,
  scalePanelDimension,
} from "./panel-scale";

describe("panel scale", () => {
  it("keeps supported preset values unchanged", () => {
    expect(normalizePanelScale(85)).toBe(85);
    expect(normalizePanelScale(100)).toBe(100);
    expect(normalizePanelScale(150)).toBe(150);
  });

  it("falls back to the nearest supported preset when given an arbitrary value", () => {
    expect(normalizePanelScale(92)).toBe(100);
    expect(normalizePanelScale(122)).toBe(115);
    expect(normalizePanelScale(141)).toBe(150);
  });

  it("converts panel scale percentages into zoom factors and scaled sizes", () => {
    expect(getPanelScaleFactor(85)).toBe(0.85);
    expect(getPanelScaleFactor(150)).toBe(1.5);
    expect(scalePanelDimension(364, 150)).toBe(546);
  });

  it("maps slider positions to the supported scale presets", () => {
    expect(getPanelScaleSliderIndex(85)).toBe(0);
    expect(getPanelScaleSliderIndex(115)).toBe(2);
    expect(getPanelScaleFromSliderIndex(4)).toBe(150);
  });
});
