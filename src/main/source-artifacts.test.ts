import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("source artifacts", () => {
  it("does not keep emitted JavaScript or declaration files inside src/main", () => {
    const mainDir = path.resolve(__dirname);
    const artifacts = fs
      .readdirSync(mainDir)
      .filter((entry) => entry.endsWith(".js") || entry.endsWith(".d.ts"));

    expect(artifacts).toEqual([]);
  });
});
