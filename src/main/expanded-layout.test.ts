import { describe, expect, it } from "vitest";

import { getExpandedWindowHeight } from "./expanded-layout";

describe("getExpandedWindowHeight", () => {
  it("uses the measured content height when it is within bounds", () => {
    expect(
      getExpandedWindowHeight({
        contentHeight: 318,
        settingsOpen: false,
      }),
    ).toBe(318);
  });

  it("caps the height when content would exceed the expanded panel maximum", () => {
    expect(
      getExpandedWindowHeight({
        contentHeight: 640,
        settingsOpen: false,
      }),
    ).toBe(500);
  });

  it("keeps the full height while settings are open", () => {
    expect(
      getExpandedWindowHeight({
        contentHeight: 318,
        settingsOpen: true,
      }),
    ).toBe(500);
  });
});
