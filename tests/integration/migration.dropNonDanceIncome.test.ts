import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureSchema, closeDb } from "./helpers/db";
import { sql } from "@/server/db/client";

// Feature 038 (P6-R6): the 0031 migration drops the unused non_dance_income table. Executing the actual
// migration SQL is the single source of truth; `DROP TABLE IF EXISTS` makes it idempotent (FR-006).
const MIGRATION = join(process.cwd(), "src/server/db/migrations/0031_drop_non_dance_income.sql");

async function tableExists(name: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM information_schema.tables WHERE table_name = ${name}`;
  return rows.length > 0;
}

describe("0031 drop non_dance_income", () => {
  beforeAll(ensureSchema); // applies all migrations, incl. 0031 once it exists
  afterAll(closeDb);

  it("removes the table and is idempotent (safe to re-run)", async () => {
    const text = await readFile(MIGRATION, "utf8");
    await sql.unsafe(text);
    expect(await tableExists("non_dance_income")).toBe(false);
    await sql.unsafe(text); // second run must not error
    expect(await tableExists("non_dance_income")).toBe(false);
  });
});
