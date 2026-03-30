import { describe, expect, it } from "vitest";

import {
  resolveClaudeDebugPath,
  resolveTrayIconPath,
} from "./runtime-paths";

describe("runtime paths", () => {
  it("reads the tray icon from the project public folder in development", () => {
    expect(
      resolveTrayIconPath({
        appPath: "D:\\coding\\projects\\tray-usage-widget",
        isPackaged: false,
        userDataPath: "C:\\Users\\tester\\AppData\\Roaming\\tray-usage-widget",
      }),
    ).toBe(
      "D:\\coding\\projects\\tray-usage-widget\\public\\tray-icon-runtime.png",
    );
  });

  it("reads the tray icon from the Electron resources folder in packaged builds", () => {
    expect(
      resolveTrayIconPath({
        appPath:
          "C:\\Users\\tester\\AppData\\Local\\Programs\\Tray Usage Widget\\resources\\app.asar",
        isPackaged: true,
        userDataPath: "C:\\Users\\tester\\AppData\\Roaming\\tray-usage-widget",
      }),
    ).toBe(
      "C:\\Users\\tester\\AppData\\Local\\Programs\\Tray Usage Widget\\resources\\tray-icon-runtime.png",
    );
  });

  it("stores debug output in userData instead of cwd", () => {
    const runtime = {
      appPath: "D:\\coding\\projects\\tray-usage-widget",
      isPackaged: false,
      userDataPath: "C:\\Users\\tester\\AppData\\Roaming\\tray-usage-widget",
    };

    expect(resolveClaudeDebugPath(runtime)).toBe(
      "C:\\Users\\tester\\AppData\\Roaming\\tray-usage-widget\\claude-debug.json",
    );
  });
});
