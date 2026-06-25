import { describe, expect, it } from "vitest";

import { resolveWidgetLanguageFromSystemLocale, t } from "./i18n";

describe("i18n", () => {
  it("returns the QuotaGem brand name in all languages", () => {
    expect(t("en", "trayUsageWidget")).toBe("QuotaGem");
    expect(t("zh-TW", "trayUsageWidget")).toBe("QuotaGem");
    expect(t("zh-CN", "trayUsageWidget")).toBe("QuotaGem");
  });

  it("keeps key usage labels available", () => {
    expect(t("en", "settings")).toBeTruthy();
    expect(t("en", "openSettings")).toBeTruthy();
    expect(t("en", "panelScale")).toBeTruthy();
    expect(t("en", "dateFormat")).toBeTruthy();
    expect(t("en", "settingsAntigravityTab")).toBe("Antigravity");
    expect(t("en", "bothProviders")).toBe("Show all");
    expect(t("en", "agyOnly")).toBe("Antigravity only");
  });

  it("provides Simplified Chinese labels", () => {
    expect(t("zh-CN", "settings")).toBe("设置");
    expect(t("zh-CN", "simplifiedChinese")).toBe("简体中文");
    expect(t("zh-CN", "codexDataSourceLocal")).toBe("本地数据");
    expect(t("zh-CN", "settingsGeneralTab")).toBe("通用");
    expect(t("zh-CN", "settingsClaudeTab")).toBe("Claude");
    expect(t("zh-CN", "settingsAntigravityTab")).toBe("Antigravity");
    expect(t("zh-CN", "generalAppearanceTab")).toBe("外观");
    expect(t("zh-CN", "minimal")).toBe("极简");
    expect(t("zh-CN", "bothProviders")).toBe("显示所有");
    expect(t("zh-CN", "agyOnly")).toBe("只显示 Antigravity");
    expect(t("zh-CN", "codexShowRemainingUsage")).toBe("显示剩余用量");
    expect(t("zh-CN", "expandedPanel")).toBe("小面板");
    expect(t("zh-CN", "compactPanel")).toBe("大面板");
    expect(t("zh-CN", "historyUsageSummary", {
      cost: "$1.23",
      tokens: "1百万",
    })).toBe("历史用量：1百万（$1.23）");
  });

  it("maps system locales to the expected widget language", () => {
    expect(resolveWidgetLanguageFromSystemLocale("zh-CN")).toBe("zh-CN");
    expect(resolveWidgetLanguageFromSystemLocale("zh-SG")).toBe("zh-CN");
    expect(resolveWidgetLanguageFromSystemLocale("zh-Hans")).toBe("zh-CN");
    expect(resolveWidgetLanguageFromSystemLocale("zh-TW")).toBe("zh-TW");
    expect(resolveWidgetLanguageFromSystemLocale("zh-HK")).toBe("zh-TW");
    expect(resolveWidgetLanguageFromSystemLocale("en-US")).toBe("en");
    expect(resolveWidgetLanguageFromSystemLocale(undefined)).toBe("en");
  });
});
