import { describe, expect, it } from "vitest";

import {
  PANEL_THEME_OPTIONS,
  getPanelThemeStyles,
} from "./panel-themes";

describe("panel themes", () => {
  it("exposes the expanded theme list including the new presets", () => {
    expect(PANEL_THEME_OPTIONS).toEqual([
      "charcoal",
      "slate",
      "forest",
      "ocean",
      "mocha",
      "linen",
      "mist",
      "sand",
      "blossom",
    ]);
  });

  it("returns distinct css token sets for the new presets", () => {
    const oceanTheme = getPanelThemeStyles("ocean");
    const charcoalTheme = getPanelThemeStyles("charcoal");
    const forestTheme = getPanelThemeStyles("forest");
    const mochaTheme = getPanelThemeStyles("mocha");
    const linenTheme = getPanelThemeStyles("linen");
    const mistTheme = getPanelThemeStyles("mist");
    const sandTheme = getPanelThemeStyles("sand");
    const blossomTheme = getPanelThemeStyles("blossom");

    expect(oceanTheme["--panel-base-rgb"]).toBe("39, 50, 58");
    expect(oceanTheme["--panel-accent-rgb"]).toBe("122, 151, 163");
    expect(oceanTheme["--panel-color-scheme"]).toBe("dark");
    expect(forestTheme["--panel-base-rgb"]).toBe("39, 46, 43");
    expect(forestTheme["--panel-accent-rgb"]).toBe("130, 154, 141");
    expect(charcoalTheme["--panel-input-rgb"]).toBe("44, 47, 55");
    expect(charcoalTheme["--panel-button-rgb"]).toBe("72, 76, 89");
    expect(charcoalTheme["--panel-pill-rgb"]).toBe("255, 255, 255");
    expect(mochaTheme["--metric-normal-start"]).toBe("#6f9b82");
    expect(mochaTheme["--metric-warning-start"]).toBe("#b18d47");
    expect(linenTheme["--panel-base-rgb"]).toBe("236, 228, 214");
    expect(linenTheme["--panel-color-scheme"]).toBe("light");
    expect(linenTheme["--panel-text-rgb"]).toBe("60, 46, 35");
    expect(linenTheme["--panel-button-text-rgb"]).toBe("60, 46, 35");
    expect(mistTheme["--panel-base-rgb"]).toBe("245, 244, 241");
    expect(mistTheme["--panel-text-rgb"]).toBe("80, 77, 74");
    expect(mistTheme["--panel-button-border-rgb"]).toBe("220, 215, 209");
    expect(sandTheme["--panel-footer-rgb"]).toBe("234, 220, 198");
    expect(sandTheme["--panel-shadow-rgb"]).toBe("112, 89, 60");
    expect(blossomTheme["--panel-base-rgb"]).toBe("244, 236, 237");
    expect(blossomTheme["--panel-input-rgb"]).toBe("249, 243, 244");
    expect(blossomTheme["--panel-button-text-rgb"]).toBe("90, 73, 77");
    expect(blossomTheme["--panel-pill-rgb"]).toBe("150, 128, 133");
    expect(blossomTheme["--metric-danger-end"]).toBe("#dea0a7");
  });
});
