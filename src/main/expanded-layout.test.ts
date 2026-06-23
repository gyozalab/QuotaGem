import { describe, expect, it } from "vitest";

import { getExpandedWindowHeight } from "./expanded-layout";

describe("getExpandedWindowHeight", () => {
  it("keeps the default expanded panel height when measured content is shorter", () => {
    expect(
      getExpandedWindowHeight({
        contentHeight: 318,
        settingsOpen: false,
      }),
    ).toBe(500);
  });

  it("uses the measured content height when it is taller than the default", () => {
    expect(
      getExpandedWindowHeight({
        contentHeight: 620,
        settingsOpen: false,
      }),
    ).toBe(620);
  });

  it("caps the height when content would exceed the expanded panel maximum", () => {
    expect(
      getExpandedWindowHeight({
        contentHeight: 900,
        settingsOpen: false,
      }),
    ).toBe(850);
  });

  it("keeps the default expanded panel height while settings are open", () => {
    expect(
      getExpandedWindowHeight({
        contentHeight: 318,
        settingsOpen: true,
      }),
    ).toBe(500);
  });
});
