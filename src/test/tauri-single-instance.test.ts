import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "..", "..");

describe("Tauri single-instance wiring", () => {
  it("declares the official single-instance plugin dependency", () => {
    const cargoToml = fs.readFileSync(path.join(repoRoot, "src-tauri", "Cargo.toml"), "utf8");

    expect(cargoToml).toMatch(/tauri-plugin-single-instance\s*=\s*"2"/);
  });

  it("registers single-instance before every other Tauri builder plugin", () => {
    const libRs = fs.readFileSync(path.join(repoRoot, "src-tauri", "src", "lib.rs"), "utf8");
    const runBody = libRs.slice(libRs.indexOf("pub fn run()"));
    const pluginCalls = [...runBody.matchAll(/\.plugin\(([^)\n]+)/g)].map((match) => match[1].trim());

    expect(pluginCalls[0]).toContain("tauri_plugin_single_instance::init");
  });
});
