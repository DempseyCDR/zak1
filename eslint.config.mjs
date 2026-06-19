import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      ".next/",
      "dist/",
      "build/",
      "coverage/",
      "*.min.js",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Constitution Principle IV: no ad-hoc logging in production paths.
      "no-console": "error",
    },
  },
  {
    // Tooling/scripts may log.
    files: ["src/server/db/migrate.ts", "src/server/db/seed.ts", "tests/**"],
    rules: { "no-console": "off" },
  },
);
