export type WidgetLanguage = "en" | "zh-TW" | "zh-CN";

export function normalizeWidgetLanguage(value: unknown): WidgetLanguage {
  if (value === "zh-TW" || value === "zh-CN" || value === "en") {
    return value;
  }

  return "en";
}

export function resolveWidgetLanguageFromSystemLocale(
  locale: string | null | undefined,
): WidgetLanguage {
  const normalized = locale?.toLowerCase() ?? "";

  if (
    normalized.includes("hans") ||
    normalized.startsWith("zh-cn") ||
    normalized.startsWith("zh-sg") ||
    normalized.startsWith("zh-my")
  ) {
    return "zh-CN";
  }

  if (
    normalized.includes("hant") ||
    normalized.startsWith("zh-tw") ||
    normalized.startsWith("zh-hk") ||
    normalized.startsWith("zh-mo")
  ) {
    return "zh-TW";
  }

  return "en";
}

type TranslationKey =
  | "waitingForProviderData"
  | "updatedJustNow"
  | "updatedMinutesAgo"
  | "updatedAt"
  | "refreshing"
  | "session"
  | "weekly"
  | "resets"
  | "unavailable"
  | "live"
  | "localSuffix"
  | "utcSuffix"
  | "taipeiSuffix"
  | "taipeiTime"
  | "settings"
  | "closeSettings"
  | "connectClaude"
  | "waitingForClaudeLogin"
  | "preferredDisplayMode"
  | "launchAtLogin"
  | "providerVisibility"
  | "codexDataSource"
  | "codexDataSourceOfficial"
  | "codexDataSourceLocal"
  | "codexProviderMultiplier"
  | "codexDailyLimit"
  | "codexWeeklyLimit"
  | "codexMonthlyLimit"
  | "codexShowRemainingUsage"
  | "remainingPercent"
  | "historyUsageSummary"
  | "weeklyUsageSummary"
  | "todayUsageSummary"
  | "settingsGeneralTab"
  | "settingsCodexTab"
  | "settingsClaudeTab"
  | "generalSettingsHint"
  | "generalBehaviorTab"
  | "generalAlertsTab"
  | "generalTimeTab"
  | "generalAppearanceTab"
  | "codexSettingsHint"
  | "claudeSettingsHint"
  | "expandedPanel"
  | "compactPanel"
  | "bothProviders"
  | "claudeOnly"
  | "codexOnly"
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
  | "simplifiedChinese"
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
    weekly: "Weekly",
    resets: "Resets",
    unavailable: "Unavailable",
    live: "Live",
    localSuffix: "Local",
    utcSuffix: "UTC",
    taipeiSuffix: "Taipei",
    taipeiTime: "Taipei time (UTC+8)",
    settings: "Settings",
    closeSettings: "Close settings",
    connectClaude: "Connect Claude",
    waitingForClaudeLogin: "Waiting for Claude login...",
    preferredDisplayMode: "Default panel to open",
    launchAtLogin: "Launch on Windows sign-in",
    providerVisibility: "Show providers",
    codexDataSource: "Codex data source",
    codexDataSourceOfficial: "Official",
    codexDataSourceLocal: "Local data",
    codexProviderMultiplier: "Provider multiplier",
    codexDailyLimit: "Daily limit ($)",
    codexWeeklyLimit: "Weekly limit ($)",
    codexMonthlyLimit: "Monthly limit ($)",
    codexShowRemainingUsage: "Show remaining usage",
    remainingPercent: "Remaining {percent}%",
    settingsGeneralTab: "General",
    settingsCodexTab: "Codex",
    settingsClaudeTab: "Claude",
    generalSettingsHint: "Choose how the widget behaves, looks, and refreshes.",
    generalBehaviorTab: "Behavior",
    generalAlertsTab: "Alerts",
    generalTimeTab: "Time",
    generalAppearanceTab: "Appearance",
    codexSettingsHint: "Choose the Codex data source and local pricing rules.",
    claudeSettingsHint: "Connect Claude through the login window and manage Claude here.",
    expandedPanel: "Compact panel",
    compactPanel: "Expanded panel",
    bothProviders: "Claude + Codex",
    claudeOnly: "Claude only",
    codexOnly: "Codex only",
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
    simplifiedChinese: "Simplified Chinese",
    refreshUsage: "Refresh usage",
    openSettings: "Open settings",
    openExpandedUsagePanel: "Open compact usage panel",
    openCompactUsagePanel: "Open expanded usage panel",
    historyUsageSummary: "History: {tokens} ({cost})",
    weeklyUsageSummary: "This week: {tokens} ({cost})",
    todayUsageSummary: "Today: {tokens} ({cost})",
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
    weekly: "每週",
    resets: "重設",
    unavailable: "無法取得",
    live: "即時",
    localSuffix: "本機",
    utcSuffix: "UTC",
    taipeiSuffix: "台北",
    taipeiTime: "台北時間 (UTC+8)",
    settings: "設定",
    closeSettings: "關閉設定",
    connectClaude: "連接 Claude",
    waitingForClaudeLogin: "等待 Claude 登入中...",
    preferredDisplayMode: "預設開啟面板",
    launchAtLogin: "Windows 登入時啟動",
    providerVisibility: "顯示項目",
    codexDataSource: "Codex 資料來源",
    codexDataSourceOfficial: "官方",
    codexDataSourceLocal: "本機資料",
    codexProviderMultiplier: "供應商倍率",
    codexDailyLimit: "每日限額 ($)",
    codexWeeklyLimit: "每週限額 ($)",
    codexMonthlyLimit: "每月限額 ($)",
    codexShowRemainingUsage: "顯示剩餘用量",
    remainingPercent: "剩餘 {percent}%",
    settingsGeneralTab: "通用",
    settingsCodexTab: "Codex",
    settingsClaudeTab: "Claude",
    generalSettingsHint: "調整面板行為、外觀與更新方式。",
    generalBehaviorTab: "行為",
    generalAlertsTab: "提醒",
    generalTimeTab: "時間",
    generalAppearanceTab: "外觀",
    codexSettingsHint: "選擇 Codex 資料來源與本機成本換算規則。",
    claudeSettingsHint: "透過登入視窗連接 Claude，並在這裡管理相關設定。",
    expandedPanel: "小面板",
    compactPanel: "大面板",
    bothProviders: "Claude + Codex",
    claudeOnly: "只顯示 Claude",
    codexOnly: "只顯示 Codex",
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
    simplifiedChinese: "简体中文",
    refreshUsage: "重新整理用量",
    openSettings: "開啟設定",
    openExpandedUsagePanel: "開啟小面板",
    openCompactUsagePanel: "開啟大面板",
    historyUsageSummary: "歷史用量：{tokens}（{cost}）",
    weeklyUsageSummary: "本週用量：{tokens}（{cost}）",
    todayUsageSummary: "今日用量：{tokens}（{cost}）",
    hidePanel: "收起面板",
    openUsagePanel: "開啟用量面板",
    quit: "結束",
    trayUsageWidget: "QuotaGem",
    usageAlertBody: "{provider} 的 {metric} 用量已達 {percent}%。",
  },
  "zh-CN": {
    waitingForProviderData: "正在等待 provider 数据",
    updatedJustNow: "刚刚更新",
    updatedMinutesAgo: "{minutes} 分钟前更新",
    updatedAt: "更新于 {time}",
    refreshing: "刷新中...",
    session: "每五小时",
    weekly: "每周",
    resets: "重置",
    unavailable: "无法获取",
    live: "实时",
    localSuffix: "本机",
    utcSuffix: "UTC",
    taipeiSuffix: "台北",
    taipeiTime: "台北时间 (UTC+8)",
    settings: "设置",
    closeSettings: "关闭设置",
    connectClaude: "连接 Claude",
    waitingForClaudeLogin: "等待 Claude 登录中...",
    preferredDisplayMode: "默认打开面板",
    launchAtLogin: "Windows 登录时启动",
    providerVisibility: "显示项目",
    codexDataSource: "Codex 数据来源",
    codexDataSourceOfficial: "官方",
    codexDataSourceLocal: "本地数据",
    codexProviderMultiplier: "供应商倍率",
    codexDailyLimit: "每日限额 ($)",
    codexWeeklyLimit: "每周限额 ($)",
    codexMonthlyLimit: "每月限额 ($)",
    codexShowRemainingUsage: "显示剩余用量",
    remainingPercent: "剩余 {percent}%",
    settingsGeneralTab: "通用",
    settingsCodexTab: "Codex",
    settingsClaudeTab: "Claude",
    generalSettingsHint: "调整面板行为、外观与刷新方式。",
    generalBehaviorTab: "行为",
    generalAlertsTab: "提醒",
    generalTimeTab: "时间",
    generalAppearanceTab: "外观",
    codexSettingsHint: "选择 Codex 数据来源与本地成本换算规则。",
    claudeSettingsHint: "通过登录窗口连接 Claude，并在这里管理相关设置。",
    expandedPanel: "小面板",
    compactPanel: "大面板",
    bothProviders: "Claude + Codex",
    claudeOnly: "只显示 Claude",
    codexOnly: "只显示 Codex",
    refreshInterval: "更新频率",
    warningThreshold: "警告阈值",
    dangerThreshold: "危险阈值",
    enableNotifications: "启用通知",
    notificationMode: "通知模式",
    notificationAllLevels: "警告与危险",
    notificationDangerOnly: "只提醒危险",
    oneMinute: "1 分钟",
    fiveMinutes: "5 分钟",
    fifteenMinutes: "15 分钟",
    resetTimeTimezone: "重置时间时区",
    localTime: "本机时间",
    timeDisplayFormat: "时间显示格式",
    dateFormat: "日期格式",
    dateFormatIso: "YYYY-MM-DD",
    dateFormatMdy: "MM/DD/YYYY",
    dateFormatDmy: "DD/MM/YYYY",
    twentyFourHour: "24 小时制",
    twelveHour: "12 小时制",
    panelScale: "面板缩放",
    panelTransparency: "面板透明度",
    panelBackgroundColor: "面板背景色",
    charcoal: "木炭黑",
    slate: "石板灰",
    forest: "灰绿色",
    ocean: "灰蓝色",
    mocha: "摩卡棕",
    linen: "浅米色",
    mist: "雾灰色",
    sand: "沙色",
    blossom: "淡粉色",
    savePreferences: "保存设置",
    savedClaudeAccepted: "设置已保存。",
    couldNotSaveClaudeSettings: "无法保存设置。",
    recommendedConnectClaude:
      "建议直接按“连接 Claude”。只有在登录流程失败时，才需要改用手动凭证。",
    codexAutoDetected:
      "Codex 用量会从本地桌面数据自动检测。Claude 建议使用下方登录窗口来连接。",
    claudeConnectedSuccessfully: "Claude 连接成功。",
    couldNotConnectClaude: "无法连接 Claude。",
    language: "语言",
    english: "English",
    traditionalChinese: "繁體中文",
    simplifiedChinese: "简体中文",
    refreshUsage: "刷新用量",
    openSettings: "打开设置",
    openExpandedUsagePanel: "打开小面板",
    openCompactUsagePanel: "打开大面板",
    historyUsageSummary: "历史用量：{tokens}（{cost}）",
    weeklyUsageSummary: "本周用量：{tokens}（{cost}）",
    todayUsageSummary: "今日用量：{tokens}（{cost}）",
    hidePanel: "收起面板",
    openUsagePanel: "打开用量面板",
    quit: "退出",
    trayUsageWidget: "QuotaGem",
    usageAlertBody: "{provider} 的 {metric} 用量已达 {percent}%。",
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
