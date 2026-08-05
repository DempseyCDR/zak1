import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureSchema, closeDb } from "./helpers/db";
import { sql } from "@/server/db/client";

// Feature 039 (P6-R7): the 0032 migration drops the dead account_mapping GL-account catalog. Executing the
// actual migration SQL is the single source of truth; `DROP TABLE IF EXISTS` makes it idempotent (FR-006).
const MIGRATION = join(process.cwd(), "src/server/db/migrations/0032_drop_account_mapping.sql");

async function tableExists(name: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM information_schema.tables WHERE table_name = ${name}`;
  return rows.length > 0;
}

describe("0032 drop account_mapping", () => {
  beforeAll(ensureSchema); // applies all migrations, incl. 0032 once it exists
  afterAll(closeDb);

  it("removes the table and is idempotent (safe to re-run)", async () => {
    const text = await readFile(MIGRATION, "utf8");
    await sql.unsafe(text);
    expect(await tableExists("account_mapping")).toBe(false);
    await sql.unsafe(text); // second run must not error
    expect(await tableExists("account_mapping")).toBe(false);
  });
});
