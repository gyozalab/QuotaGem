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
      }),
    ).toEqual({
      width: 354,
      height: 187,
    });
  });
});
