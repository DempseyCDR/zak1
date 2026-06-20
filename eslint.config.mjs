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
      "next-env.d.ts",
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
    // Tooling/scripts/jobs may log to the console (CLI entrypoints).
    files: ["src/server/db/migrate.ts", "src/server/db/seed.ts", "src/jobs/**", "tests/**"],
    rules: { "no-console": "off" },
  },
);
