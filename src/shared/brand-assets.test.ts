import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("QuotaGem brand assets", () => {
  it("keeps a more spacious primary brand mark for large-format usage", () => {
    const svg = readFileSync(
      resolve(__dirname, "../../public/quota-gem-mark.svg"),
      "utf8",
    );

    expect(svg).toContain('cx="22" cy="33" r="10.4"');
    expect(svg).toContain('cx="38" cy="19" r="6.2"');
    expect(svg).toContain('cx="48" cy="46" r="3.4"');
  });

  it("keeps a tighter compact mark for tray and header usage", () => {
    const svg = readFileSync(
      resolve(__dirname, "../../public/quota-gem-mark-compact.svg"),
      "utf8",
    );

    expect(svg).toContain('cx="23" cy="31" r="7.2"');
    expect(svg).toContain('cx="34" cy="20" r="4.1"');
    expect(svg).toContain('cx="37" cy="40" r="5.4"');
  });
});
