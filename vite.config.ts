import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";

export default defineConfig(({ mode }) => ({
  plugins:
    mode === "test"
      ? [react()]
      : [
          react(),
          electron({
            main: {
              entry: "src/main/main.ts",
            },
            preload: {
              input: path.join(__dirname, "src/main/preload.ts"),
            },
          }),
        ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
}));
