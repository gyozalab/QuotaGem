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

  it("allows all three provider cards to exceed the old 500px cap", () => {
    expect(
      getExpandedWindowHeight({
        contentHeight: 640,
        settingsOpen: false,
      }),
    ).toBe(640);
  });

  it("retains a safety cap for exceptionally tall content", () => {
    expect(
      getExpandedWindowHeight({
        contentHeight: 900,
        settingsOpen: false,
      }),
    ).toBe(680);
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
