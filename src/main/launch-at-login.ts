import path from "node:path";

interface LoginItemSettingsQuery {
  path?: string;
  args?: string[];
}

interface LoginItemSettingsUpdate extends LoginItemSettingsQuery {
  openAtLogin: boolean;
}

export interface LaunchAtLoginAdapter {
  getLoginItemSettings: (options?: LoginItemSettingsQuery) => {
    openAtLogin: boolean;
  };
  setLoginItemSettings: (settings: LoginItemSettingsUpdate) => void;
}

export interface LaunchAtLoginRuntime {
  platform: NodeJS.Platform;
  execPath: string;
  argv: string[];
  defaultApp: boolean;
}

export function getLaunchAtLoginRuntime(): LaunchAtLoginRuntime {
  return {
    platform: process.platform,
    execPath: process.execPath,
    argv: process.argv,
    defaultApp: Boolean(process.defaultApp),
  };
}

export function buildLaunchAtLoginSettings(
  openAtLogin: boolean,
  runtime: LaunchAtLoginRuntime,
): LoginItemSettingsUpdate {
  return {
    openAtLogin,
    ...buildLaunchAtLoginQuery(runtime),
  };
}

export function readLaunchAtLoginPreference(
  app: LaunchAtLoginAdapter,
  runtime: LaunchAtLoginRuntime,
): boolean {
  return app.getLoginItemSettings(buildLaunchAtLoginQuery(runtime)).openAtLogin;
}

export function syncLaunchAtLoginPreference(
  app: LaunchAtLoginAdapter,
  openAtLogin: boolean,
  runtime: LaunchAtLoginRuntime,
): void {
  app.setLoginItemSettings(buildLaunchAtLoginSettings(openAtLogin, runtime));
}

function buildLaunchAtLoginQuery(
  runtime: LaunchAtLoginRuntime,
): LoginItemSettingsQuery {
  if (runtime.platform !== "win32" || !runtime.defaultApp || !runtime.argv[1]) {
    return {};
  }

  return {
    path: runtime.execPath,
    args: [path.resolve(runtime.argv[1])],
  };
}
