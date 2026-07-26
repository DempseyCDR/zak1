import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Default env is node (DB integration/unit tests). Component tests (.test.tsx) opt into jsdom with a
    // `// @vitest-environment jsdom` docblock — see tests/setup.dom.ts.
    environment: "node",
    globals: false,
    // Integration tests share one Postgres database; run serially to avoid
    // cross-test interference from truncation between tests.
    fileParallelism: false,
    setupFiles: ["tests/setup.ts", "tests/setup.dom.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
