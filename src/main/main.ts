import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  screen,
  session,
  Tray,
} from "electron";
import Store from "electron-store";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { UsageDashboardState } from "../shared/dashboard";
import { t } from "../shared/i18n";
import {
  getLaunchAtLoginRuntime,
  readLaunchAtLoginPreference,
  syncLaunchAtLoginPreference,
} from "./launch-at-login";
import {
  buildDashboardState,
  primeClaudeSession,
  resolveClaudeOrganizationId,
  type AppStoreShape,
} from "./provider-service";
import { getExpandedWindowHeight } from "./expanded-layout";
import {
  getExpandedBaseSize,
  getPanelSize,
} from "./panel-layout";
import { resolveTrayIconPath } from "./runtime-paths";
import { createUsageAlertTracker } from "./usage-alerts";
import { getPanelScaleFactor, normalizePanelScale } from "../shared/panel-scale";
import { normalizeUsageThresholds } from "../shared/usage";

let expandedWindow: BrowserWindow | null = null;
let compactWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let refreshTimer: NodeJS.Timeout | null = null;
let usageAlertsPrimed = false;

const WINDOW_MARGIN = 14;
const launchAtLoginRuntime = getLaunchAtLoginRuntime();
let expandedWindowHeight = getExpandedBaseSize().height;
const usageAlertTracker = createUsageAlertTracker();

const store = new Store<AppStoreShape>({
  name: "quota-gem",
  defaults: {
    preferredDisplayMode: "expanded",
    launchAtLogin: false,
    providerVisibility: "both",
    refreshIntervalMinutes: 5,
    warningThreshold: 75,
    dangerThreshold: 90,
    notificationsEnabled: true,
    notificationLevel: "all",
    language: "en",
    timeDisplay: "utc",
    timeFormat: "24h",
    dateFormat: "iso",
    panelScale: 100,
    panelOpacity: 90,
    panelTone: "charcoal",
  },
});

function createExpandedWindow() {
  const size = getPanelSize({
    mode: "expanded",
    panelScale: getCurrentPanelScale(),
    expandedWindowHeight,
  });
  expandedWindow = new BrowserWindow({
    width: size.width,
    height: size.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  expandedWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      expandedWindow?.hide();
    }
  });

  void loadRenderer(expandedWindow, "expanded");
}

function createCompactWindow() {
  if (compactWindow) {
    return;
  }

  const size = getPanelSize({
    mode: "compact",
    panelScale: getCurrentPanelScale(),
    expandedWindowHeight,
  });
  compactWindow = new BrowserWindow({
    width: size.width,
    height: size.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  compactWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      compactWindow?.hide();
    }
  });

  void loadRenderer(compactWindow, "compact");
}

async function loadRenderer(
  window: BrowserWindow,
  mode: "expanded" | "compact",
) {
  if (process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(`${process.env.VITE_DEV_SERVER_URL}?mode=${mode}`);
    window.webContents.setZoomFactor(getPanelScaleFactor(getCurrentPanelScale()));
    return;
  }

  const rendererFile = path.join(app.getAppPath(), "dist", "index.html");
  await window.loadURL(`${pathToFileURL(rendererFile).toString()}?mode=${mode}`);
  window.webContents.setZoomFactor(getPanelScaleFactor(getCurrentPanelScale()));
}

function createTray() {
  const iconPath = resolveTrayIconPath({
    appPath: app.getAppPath(),
    isPackaged: app.isPackaged,
    userDataPath: app.getPath("userData"),
  });
  const image = nativeImage.createFromPath(iconPath).resize({ width: 20, height: 20 });
  const language = store.get("language", "en");

  tray = new Tray(image);
  tray.setToolTip(t(language, "trayUsageWidget"));
  tray.on("click", () => {
    togglePreferredWindow();
  });
  tray.on("right-click", () => {
    const shouldRestoreCompact = compactWindow?.isVisible();

    if (shouldRestoreCompact) {
      compactWindow?.hide();
    }

    const menu = buildTrayMenu();
    menu.once("menu-will-close", () => {
      if (shouldRestoreCompact && compactWindow && !expandedWindow?.isVisible()) {
        positionWindow(compactWindow, "compact");
        compactWindow.show();
      }
    });

    tray?.popUpContextMenu(menu);
  });
}

function buildTrayMenu() {
  const language = store.get("language", "en");
  return Menu.buildFromTemplate([
    {
      label: t(language, "openUsagePanel"),
      click: () => {
        showPreferredWindow();
      },
    },
    {
      label: t(language, "quit"),
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

async function connectClaudeViaLogin(): Promise<UsageDashboardState> {
  const sessionKey = await detectClaudeSessionKey();
  const organizationId = await resolveClaudeOrganizationId(sessionKey);

  if (!organizationId) {
    throw new Error(
      "Claude login succeeded, but organization ID could not be resolved.",
    );
  }

  store.set("claudeSessionKey", sessionKey);
  store.set("claudeOrganizationId", organizationId);
  return buildDashboardState(store, getLaunchAtLoginPreference());
}

function getLaunchAtLoginPreference(): boolean {
  return readLaunchAtLoginPreference(app, launchAtLoginRuntime);
}

async function detectClaudeSessionKey(): Promise<string> {
  primeClaudeSession();

  try {
    await session.defaultSession.cookies.remove("https://claude.ai", "sessionKey");
  } catch {
    // ignore stale cookie cleanup failures
  }

  return new Promise((resolve, reject) => {
    const loginWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      title: "Log in to Claude",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    let resolved = false;
    const onCookieChanged = (
      _event: Electron.Event,
      cookie: Electron.Cookie,
      _cause: unknown,
      removed: boolean,
    ) => {
      if (
        cookie.name === "sessionKey" &&
        cookie.domain?.includes("claude.ai") &&
        !removed &&
        cookie.value
      ) {
        resolved = true;
        session.defaultSession.cookies.removeListener("changed", onCookieChanged);
        loginWindow.close();
        resolve(cookie.value);
      }
    };

    session.defaultSession.cookies.on("changed", onCookieChanged);

    loginWindow.on("closed", () => {
      session.defaultSession.cookies.removeListener("changed", onCookieChanged);
      if (!resolved) {
        reject(new Error("Claude login window was closed before sign-in finished."));
      }
    });

    void loginWindow.loadURL("https://claude.ai/login");
  });
}

function togglePreferredWindow() {
  const preferredMode = store.get("preferredDisplayMode", "expanded");
  const preferredWindow = preferredMode === "compact" ? compactWindow : expandedWindow;

  if (preferredWindow?.isVisible()) {
    closePanels();
    return;
  }

  showPreferredWindow();
}

function showPreferredWindow() {
  const preferredMode = store.get("preferredDisplayMode", "expanded");
  if (preferredMode === "compact") {
    showCompactWindow();
    return;
  }

  showExpandedWindow();
}

function showExpandedWindow() {
  if (!expandedWindow) {
    return;
  }

  compactWindow?.hide();
  expandedWindow.setAlwaysOnTop(true);
  positionWindow(expandedWindow, "expanded");
  expandedWindow.show();
  expandedWindow.focus();
  expandedWindow.webContents.send("usage:refreshRequested");
}

function showCompactWindow() {
  createCompactWindow();

  if (!compactWindow) {
    return;
  }

  expandedWindow?.hide();
  compactWindow.setAlwaysOnTop(true);
  positionWindow(compactWindow, "compact");
  compactWindow.show();
  compactWindow.focus();
  compactWindow.webContents.send("usage:refreshRequested");
}

function closePanels() {
  expandedWindow?.hide();
  compactWindow?.hide();
}

function getCurrentPanelScale(): number {
  return normalizePanelScale(store.get("panelScale", 100));
}

function applyPanelScale(window: BrowserWindow | null): void {
  if (!window || window.isDestroyed()) {
    return;
  }

  window.webContents.setZoomFactor(getPanelScaleFactor(getCurrentPanelScale()));
}

function syncWindowLayouts(): void {
  if (expandedWindow) {
    applyPanelScale(expandedWindow);
    positionWindow(expandedWindow, "expanded");
  }

  if (compactWindow) {
    applyPanelScale(compactWindow);
    positionWindow(compactWindow, "compact");
  }
}

function broadcastRefresh() {
  if (expandedWindow?.isVisible()) {
    expandedWindow.webContents.send("usage:refreshRequested");
  }

  if (compactWindow?.isVisible()) {
    compactWindow.webContents.send("usage:refreshRequested");
  }
}

function configureAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  const intervalMs =
    Math.max(store.get("refreshIntervalMinutes", 5), 1) * 60_000;

  refreshTimer = setInterval(() => {
    if (expandedWindow?.isVisible() || compactWindow?.isVisible()) {
      broadcastRefresh();
      return;
    }

    void checkUsageAlerts();
  }, intervalMs);
}

async function checkUsageAlerts(): Promise<void> {
  const state = await buildDashboardState(store, getLaunchAtLoginPreference());
  processUsageAlerts(state);
}

function processUsageAlerts(state: UsageDashboardState): void {
  const alerts = usageAlertTracker.consume(state);

  if (!usageAlertsPrimed) {
    usageAlertsPrimed = true;
    return;
  }

  if (!Notification.isSupported()) {
    return;
  }

  for (const alert of alerts) {
    new Notification({
      title: alert.title,
      body: alert.body,
      silent: true,
    }).show();
  }
}

async function fetchDashboardState(): Promise<UsageDashboardState> {
  const state = await buildDashboardState(store, getLaunchAtLoginPreference());
  processUsageAlerts(state);
  return state;
}

function positionWindow(
  window: BrowserWindow,
  mode: "expanded" | "compact",
) {
  const workArea = screen.getPrimaryDisplay().workArea;
  const size = getPanelSize({
    mode,
    panelScale: getCurrentPanelScale(),
    expandedWindowHeight,
  });

  window.setBounds({
    width: size.width,
    height: size.height,
    x: workArea.x + workArea.width - size.width - WINDOW_MARGIN,
    y: workArea.y + workArea.height - size.height - WINDOW_MARGIN,
  });
}

app.whenReady().then(() => {
  primeClaudeSession();
  syncLaunchAtLoginPreference(
    app,
    store.get("launchAtLogin", false),
    launchAtLoginRuntime,
  );
  configureAutoRefresh();
  createExpandedWindow();
  createTray();
  void checkUsageAlerts().catch(() => {});

  ipcMain.handle(
    "usage:fetch",
    async (): Promise<UsageDashboardState> => fetchDashboardState(),
  );

  ipcMain.handle("window:openExpanded", async () => {
    showExpandedWindow();
  });

  ipcMain.handle(
    "window:syncExpandedLayout",
    async (
      _event,
      layout: { contentHeight: number; settingsOpen: boolean },
    ) => {
      const nextHeight = getExpandedWindowHeight(layout);
      if (expandedWindowHeight === nextHeight) {
        return;
      }

      expandedWindowHeight = nextHeight;

      if (expandedWindow) {
        positionWindow(expandedWindow, "expanded");
      }
    },
  );

  ipcMain.handle("window:openCompact", async () => {
    showCompactWindow();
  });

  ipcMain.handle("window:closePanels", async () => {
    closePanels();
  });

  ipcMain.handle("claude:connect", async () => {
    try {
      return await connectClaudeViaLogin();
    } catch (error) {
      throw new Error(formatClaudeCredentialError(error));
    }
  });

  ipcMain.handle(
    "settings:save",
    async (
      _event,
      preferences: UsageDashboardState["preferences"],
    ) => {
      const thresholds = normalizeUsageThresholds({
        warningThreshold: preferences.warningThreshold,
        dangerThreshold: preferences.dangerThreshold,
      });

      store.set("preferredDisplayMode", preferences.preferredDisplayMode);
      store.set("launchAtLogin", preferences.launchAtLogin);
      store.set("providerVisibility", preferences.providerVisibility);
      store.set("refreshIntervalMinutes", preferences.refreshIntervalMinutes);
      store.set("warningThreshold", thresholds.warningThreshold);
      store.set("dangerThreshold", thresholds.dangerThreshold);
      store.set("notificationsEnabled", preferences.notificationsEnabled);
      store.set("notificationLevel", preferences.notificationLevel);
      store.set("language", preferences.language);
      tray?.setToolTip(t(preferences.language, "trayUsageWidget"));
      store.set("timeDisplay", preferences.timeDisplay);
      store.set("timeFormat", preferences.timeFormat);
      store.set("dateFormat", preferences.dateFormat);
      store.set("panelScale", normalizePanelScale(preferences.panelScale));
      store.set("panelOpacity", preferences.panelOpacity);
      store.set("panelTone", preferences.panelTone);
      syncLaunchAtLoginPreference(
        app,
        preferences.launchAtLogin,
        launchAtLoginRuntime,
      );
      configureAutoRefresh();
      syncWindowLayouts();

      broadcastRefresh();
      return buildDashboardState(store, getLaunchAtLoginPreference());
    },
  );

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createExpandedWindow();
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Tray utilities stay resident until explicitly quit.
  }
});

function formatClaudeCredentialError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("CloudflareBlocked")) {
    return "Claude returned a Cloudflare block page. Refresh claude.ai in your browser, then copy a fresh sessionKey and try again.";
  }

  if (message.includes("CloudflareChallenge")) {
    return "Claude asked for an extra browser challenge. Open claude.ai in your browser, complete any check, then paste a fresh sessionKey.";
  }

  if (message.includes("UnexpectedHTML")) {
    return "Claude returned an HTML page instead of usage JSON. This usually means the session key is expired or the request was blocked.";
  }

  if (message.includes("403")) {
    return "Claude returned 403 Forbidden. The session key was saved, but Claude did not accept it for the usage API.";
  }

  return message;
}
