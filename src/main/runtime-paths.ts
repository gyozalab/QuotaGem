import path from "node:path";

export interface AppRuntimePaths {
  appPath: string;
  isPackaged: boolean;
  userDataPath: string;
}

export function resolveTrayIconPath(runtime: AppRuntimePaths): string {
  if (runtime.isPackaged) {
    return path.join(path.dirname(runtime.appPath), "tray-icon-runtime.png");
  }

  return path.join(runtime.appPath, "public", "tray-icon-runtime.png");
}

export function resolveClaudeDebugPath(runtime: AppRuntimePaths): string {
  return path.join(runtime.userDataPath, "claude-debug.json");
}
