import { describe, expect, it } from "vitest";

import { t } from "./i18n";

describe("i18n", () => {
  it("returns the QuotaGem brand name in both languages", () => {
    expect(t("en", "trayUsageWidget")).toBe("QuotaGem");
    expect(t("zh-TW", "trayUsageWidget")).toBe("QuotaGem");
  });

  it("keeps key usage labels available", () => {
    expect(t("en", "settings")).toBeTruthy();
    expect(t("en", "openSettings")).toBeTruthy();
    expect(t("en", "panelScale")).toBeTruthy();
    expect(t("en", "dateFormat")).toBeTruthy();
  });
});
