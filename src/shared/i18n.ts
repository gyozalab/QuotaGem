export type WidgetLanguage = "en" | "zh-TW";

type TranslationKey =
  | "waitingForProviderData"
  | "updatedJustNow"
  | "updatedMinutesAgo"
  | "updatedAt"
  | "refreshing"
  | "session"
  | "daily"
  | "weekly"
  | "resets"
  | "unavailable"
  | "live"
  | "localSuffix"
  | "utcSuffix"
  | "settings"
  | "closeSettings"
  | "connectClaude"
  | "waitingForClaudeLogin"
  | "preferredDisplayMode"
  | "launchAtLogin"
  | "providerVisibility"
  | "expandedPanel"
  | "compactPanel"
  | "allProviders"
  | "bothProviders"
  | "claudeOnly"
  | "codexOnly"
  | "geminiOnly"
  | "refreshInterval"
  | "warningThreshold"
  | "dangerThreshold"
  | "enableNotifications"
  | "notificationMode"
  | "notificationAllLevels"
  | "notificationDangerOnly"
  | "oneMinute"
  | "fiveMinutes"
  | "fifteenMinutes"
  | "resetTimeTimezone"
  | "localTime"
  | "timeDisplayFormat"
  | "dateFormat"
  | "dateFormatIso"
  | "dateFormatMdy"
  | "dateFormatDmy"
  | "twentyFourHour"
  | "twelveHour"
  | "panelScale"
  | "panelTransparency"
  | "panelBackgroundColor"
  | "charcoal"
  | "slate"
  | "forest"
  | "ocean"
  | "mocha"
  | "linen"
  | "mist"
  | "sand"
  | "blossom"
  | "savePreferences"
  | "savedClaudeAccepted"
  | "couldNotSaveClaudeSettings"
  | "recommendedConnectClaude"
  | "codexAutoDetected"
  | "claudeConnectedSuccessfully"
  | "couldNotConnectClaude"
  | "language"
  | "english"
  | "traditionalChinese"
  | "refreshUsage"
  | "openSettings"
  | "openExpandedUsagePanel"
  | "openCompactUsagePanel"
  | "hidePanel"
  | "openUsagePanel"
  | "quit"
  | "trayUsageWidget"
  | "usageAlertBody";

const translations: Record<WidgetLanguage, Record<TranslationKey, string>> = {
  en: {
    waitingForProviderData: "Waiting for provider data",
    updatedJustNow: "Updated just now",
    updatedMinutesAgo: "Updated {minutes}m ago",
    updatedAt: "Updated {time}",
    refreshing: "Refreshing...",
    session: "Session",
    daily: "Daily",
    weekly: "Weekly",
    resets: "Resets",
    unavailable: "Unavailable",
    live: "Live",
    localSuffix: "Local",
    utcSuffix: "UTC",
    settings: "Settings",
    closeSettings: "Close settings",
    connectClaude: "Connect Claude",
    waitingForClaudeLogin: "Waiting for Claude login...",
    preferredDisplayMode: "Default panel to open",
    launchAtLogin: "Launch on Windows sign-in",
    providerVisibility: "Show providers",
    expandedPanel: "Expanded panel",
    compactPanel: "Compact panel",
    allProviders: "All providers",
    bothProviders: "Claude + Codex",
    claudeOnly: "Claude only",
    codexOnly: "Codex only",
    geminiOnly: "Gemini only",
    refreshInterval: "Refresh interval",
    warningThreshold: "Warning threshold",
    dangerThreshold: "Danger threshold",
    enableNotifications: "Enable notifications",
    notificationMode: "Notification mode",
    notificationAllLevels: "Warning + danger",
    notificationDangerOnly: "Danger only",
    oneMinute: "1 minute",
    fiveMinutes: "5 minutes",
    fifteenMinutes: "15 minutes",
    resetTimeTimezone: "Reset time timezone",
    localTime: "Computer time",
    timeDisplayFormat: "Time display format",
    dateFormat: "Date format",
    dateFormatIso: "YYYY-MM-DD",
    dateFormatMdy: "MM/DD/YYYY",
    dateFormatDmy: "DD/MM/YYYY",
    twentyFourHour: "24-hour",
    twelveHour: "12-hour",
    panelScale: "Panel scale",
    panelTransparency: "Panel transparency",
    panelBackgroundColor: "Panel background color",
    charcoal: "Charcoal",
    slate: "Slate",
    forest: "Forest",
    ocean: "Ocean",
    mocha: "Mocha",
    linen: "Linen",
    mist: "Mist",
    sand: "Sand",
    blossom: "Blossom",
    savePreferences: "Save preferences",
    savedClaudeAccepted: "Preferences saved.",
    couldNotSaveClaudeSettings: "Could not save preferences.",
    recommendedConnectClaude:
      "Recommended: press Connect Claude. Use manual credentials only if the login flow does not work.",
    codexAutoDetected:
      "Codex usage is auto-detected from your local desktop data. Claude works best through the login window below.",
    claudeConnectedSuccessfully: "Claude connected successfully.",
    couldNotConnectClaude: "Could not connect Claude.",
    language: "Language",
    english: "English",
    traditionalChinese: "Traditional Chinese",
    refreshUsage: "Refresh usage",
    openSettings: "Open settings",
    openExpandedUsagePanel: "Open expanded usage panel",
    openCompactUsagePanel: "Open compact usage panel",
    hidePanel: "Hide panel",
    openUsagePanel: "Open usage panel",
    quit: "Quit",
    trayUsageWidget: "QuotaGem",
    usageAlertBody: "{provider} {metric} usage reached {percent}%.",
  },
  "zh-TW": {
    waitingForProviderData: "正在等待 provider 資料",
    updatedJustNow: "剛剛更新",
    updatedMinutesAgo: "{minutes} 分鐘前更新",
    updatedAt: "更新於 {time}",
    refreshing: "重新整理中...",
    session: "每五小時",
    daily: "每日",
    weekly: "每週",
    resets: "重設",
    unavailable: "無法取得",
    live: "即時",
    localSuffix: "本機",
    utcSuffix: "UTC",
    settings: "設定",
    closeSettings: "關閉設定",
    connectClaude: "連接 Claude",
    waitingForClaudeLogin: "等待 Claude 登入中...",
    preferredDisplayMode: "預設開啟面板",
    launchAtLogin: "Windows 登入時啟動",
    providerVisibility: "顯示項目",
    expandedPanel: "大面板",
    compactPanel: "小面板",
    allProviders: "全部顯示",
    bothProviders: "Claude + Codex",
    claudeOnly: "只顯示 Claude",
    codexOnly: "只顯示 Codex",
    geminiOnly: "只顯示 Gemini",
    refreshInterval: "更新頻率",
    warningThreshold: "警示門檻",
    dangerThreshold: "危險門檻",
    enableNotifications: "啟用通知",
    notificationMode: "通知模式",
    notificationAllLevels: "警示與危險",
    notificationDangerOnly: "只提醒危險",
    oneMinute: "1 分鐘",
    fiveMinutes: "5 分鐘",
    fifteenMinutes: "15 分鐘",
    resetTimeTimezone: "重設時間時區",
    localTime: "本機時間",
    timeDisplayFormat: "時間顯示格式",
    dateFormat: "日期格式",
    dateFormatIso: "YYYY-MM-DD",
    dateFormatMdy: "MM/DD/YYYY",
    dateFormatDmy: "DD/MM/YYYY",
    twentyFourHour: "24 小時制",
    twelveHour: "12 小時制",
    panelScale: "面板縮放",
    panelTransparency: "面板透明度",
    panelBackgroundColor: "面板背景色",
    charcoal: "木炭黑",
    slate: "石板灰",
    forest: "灰綠色",
    ocean: "灰藍色",
    mocha: "摩卡棕",
    linen: "淺米色",
    mist: "霧灰色",
    sand: "沙色",
    blossom: "淡粉色",
    savePreferences: "儲存設定",
    savedClaudeAccepted: "設定已儲存。",
    couldNotSaveClaudeSettings: "無法儲存設定。",
    recommendedConnectClaude:
      "建議直接按「連接 Claude」。只有在登入流程失敗時，才需要改用手動憑證。",
    codexAutoDetected:
      "Codex 用量會從本機桌面資料自動偵測。Claude 建議使用下方登入視窗來連接。",
    claudeConnectedSuccessfully: "Claude 連接成功。",
    couldNotConnectClaude: "無法連接 Claude。",
    language: "語言",
    english: "English",
    traditionalChinese: "繁體中文",
    refreshUsage: "重新整理用量",
    openSettings: "開啟設定",
    openExpandedUsagePanel: "開啟大面板",
    openCompactUsagePanel: "開啟小面板",
    hidePanel: "收起面板",
    openUsagePanel: "開啟用量面板",
    quit: "結束",
    trayUsageWidget: "QuotaGem",
    usageAlertBody: "{provider} 的 {metric} 用量已達 {percent}%。",
  },
};

export function t(
  language: WidgetLanguage,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  let value = translations[language][key] ?? translations.en[key] ?? key;

  if (!params) {
    return value;
  }

  for (const [paramKey, paramValue] of Object.entries(params)) {
    value = value.replace(`{${paramKey}}`, String(paramValue));
  }

  return value;
}
