import { defineConfig } from "vitest/config";

// Keep every cache out of the project folder (defaults would create ./node_modules/…).
export default defineConfig({
  cacheDir: "/tmp/vite-cache",
  test: {
    include: ["tests/**/*.test.js"],
    fsModuleCachePath: "/tmp/vitest-cache",
  },
});
