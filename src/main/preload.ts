import { contextBridge, ipcRenderer } from "electron";

import type { UsageDashboardState } from "../shared/dashboard";

contextBridge.exposeInMainWorld("trayUsageWidget", {
  fetchUsageState: () => ipcRenderer.invoke("usage:fetch") as Promise<UsageDashboardState>,
  syncExpandedLayout: (layout: {
    contentHeight: number;
    settingsOpen: boolean;
  }) => ipcRenderer.invoke("window:syncExpandedLayout", layout) as Promise<void>,
  openExpandedPanel: () => ipcRenderer.invoke("window:openExpanded") as Promise<void>,
  openCompactPanel: () => ipcRenderer.invoke("window:openCompact") as Promise<void>,
  closePanels: () => ipcRenderer.invoke("window:closePanels") as Promise<void>,
  connectClaude: () =>
    ipcRenderer.invoke("claude:connect") as Promise<UsageDashboardState>,
  saveSettings: (preferences: UsageDashboardState["preferences"]) =>
    ipcRenderer.invoke("settings:save", preferences) as Promise<UsageDashboardState>,
  onRefreshRequested: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("usage:refreshRequested", listener);
    return () => {
      ipcRenderer.removeListener("usage:refreshRequested", listener);
    };
  },
});
