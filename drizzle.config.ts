import { defineConfig } from "drizzle-kit";

// DDL is authored as SQL migrations under src/server/db/migrations (applied by
// src/server/db/migrate.ts). This config is provided for drizzle-kit tooling
// (introspection / studio) and points at the same schema definitions.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./src/server/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://rcd@localhost:5432/zak1_dev",
  },
});
