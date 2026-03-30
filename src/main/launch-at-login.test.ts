import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  buildLaunchAtLoginSettings,
  readLaunchAtLoginPreference,
  syncLaunchAtLoginPreference,
} from "./launch-at-login";

describe("launch-at-login", () => {
  it("uses the Windows entry script when the app is running as the default Electron app", () => {
    const expectedEntryScript = resolve(process.cwd(), "dist-electron/main.js");

    expect(
      buildLaunchAtLoginSettings(true, {
        platform: "win32",
        execPath: "C:\\Program Files\\Electron\\electron.exe",
        argv: [
          "C:\\Program Files\\Electron\\electron.exe",
          ".\\dist-electron\\main.js",
        ],
        defaultApp: true,
      }),
    ).toEqual({
      openAtLogin: true,
      path: "C:\\Program Files\\Electron\\electron.exe",
      args: [expectedEntryScript],
    });
  });

  it("reads the current Windows login item state using the same launch context", () => {
    const expectedEntryScript = resolve(process.cwd(), "dist-electron/main.js");
    const getLoginItemSettings = vi.fn().mockReturnValue({ openAtLogin: true });

    expect(
      readLaunchAtLoginPreference(
        {
          getLoginItemSettings,
          setLoginItemSettings: vi.fn(),
        },
        {
          platform: "win32",
          execPath: "C:\\Program Files\\Electron\\electron.exe",
          argv: [
            "C:\\Program Files\\Electron\\electron.exe",
            ".\\dist-electron\\main.js",
          ],
          defaultApp: true,
        },
      ),
    ).toBe(true);

    expect(getLoginItemSettings).toHaveBeenCalledWith({
      path: "C:\\Program Files\\Electron\\electron.exe",
      args: [expectedEntryScript],
    });
  });

  it("applies the launch-at-login setting back through Electron", () => {
    const expectedEntryScript = resolve(process.cwd(), "dist-electron/main.js");
    const setLoginItemSettings = vi.fn();

    syncLaunchAtLoginPreference(
      {
        getLoginItemSettings: vi.fn(),
        setLoginItemSettings,
      },
      false,
      {
        platform: "win32",
        execPath: "C:\\Program Files\\Electron\\electron.exe",
        argv: [
          "C:\\Program Files\\Electron\\electron.exe",
          ".\\dist-electron\\main.js",
        ],
        defaultApp: true,
      },
    );

    expect(setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: false,
      path: "C:\\Program Files\\Electron\\electron.exe",
      args: [expectedEntryScript],
    });
  });
});
