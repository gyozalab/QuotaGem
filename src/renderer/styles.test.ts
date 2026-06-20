import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("renderer styles", () => {
  it("keeps elevation on the expanded and compact panels", () => {
    const css = readFileSync(resolve(__dirname, "styles.css"), "utf8");

    expect(css).not.toMatch(/\.expanded-panel\s*\{[^}]*box-shadow:\s*none;/s);
    expect(css).not.toMatch(/\.compact-widget\s*\{[^}]*box-shadow:\s*none;/s);
  });

  it("keeps enough outer gutter so panel shadows do not clip into a square frame", () => {
    const css = readFileSync(resolve(__dirname, "styles.css"), "utf8");

    expect(css).toMatch(/\.app-shell\s*\{[^}]*padding:\s*14px;/s);
    expect(css).toMatch(/\.compact-widget\s*\{[^}]*width:\s*calc\(100%\s*-\s*28px\);/s);
    expect(css).toMatch(/\.compact-widget\s*\{[^}]*margin:\s*14px;/s);
  });

  it("keeps the QuotaGem header mark large enough to stay visible", () => {
    const css = readFileSync(resolve(__dirname, "styles.css"), "utf8");

    expect(css).toMatch(/\.panel-header__mark\s*\{[^}]*width:\s*18px;/s);
    expect(css).toMatch(/\.panel-header__mark\s*\{[^}]*height:\s*18px;/s);
  });

  it("renders provider usage as rings and keeps Antigravity identity colors", () => {
    const css = readFileSync(resolve(__dirname, "styles.css"), "utf8");

    expect(css).toMatch(/--antigravity-gemini:\s*#6798d4;/i);
    expect(css).toMatch(/--antigravity-others:\s*#[0-9a-f]{6};/i);
    expect(css).toMatch(/--ring-danger:\s*#[0-9a-f]{6};/i);
    expect(css).toMatch(
      /\.provider-icon--antigravity\s*\{[^}]*object-fit:\s*contain;/s,
    );
    expect(css).toMatch(/\.compact-widget__rings\s*\{[^}]*display:\s*flex;/s);
    expect(css).toMatch(/\.compact-provider\s*\{[^}]*min-width:\s*0;/s);
    expect(css).toMatch(
      /\.compact-ring__fill--danger\s*\{[^}]*stroke:\s*var\(--ring-danger\);/s,
    );
  });
});
