import { describe, expect, it } from "vitest";

import { t } from "./i18n";

describe("i18n usage labels", () => {
  it("uses Traditional Chinese usage period labels", () => {
    expect(t("zh-TW", "session")).toBe("每五小時");
    expect(t("zh-TW", "weekly")).toBe("每週");
  });
});
