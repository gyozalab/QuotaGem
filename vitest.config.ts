import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      "**/tmp/**",
      "**/.worktrees/**",
      "**/spikes/**",
    ],
  },
});
