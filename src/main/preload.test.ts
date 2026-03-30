import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("preload bridge", () => {
  it("does not expose unused app-name or open-settings helpers", () => {
    const preloadSource = readFileSync(resolve(__dirname, "preload.ts"), "utf8");

    expect(preloadSource).not.toContain("appName:");
    expect(preloadSource).not.toContain("openSettings:");
    expect(preloadSource).not.toContain('ipcRenderer.invoke("settings:open")');
  });
});
