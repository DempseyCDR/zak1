import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { sql } from "@/server/db/client";
import { contactRow, makeContactWithEmail } from "./helpers/factories";
import { contacts } from "@/server/db/schema";

// Feature 027 (R5-P2): the 0028 migration re-splits contacts whose full name was stored in first_name with an
// empty last_name (the pre-026 capture), splitting at the LAST space — touching only first/last, leaving
// display/search/dedup keys unchanged, idempotent by the `last_name IS NULL` guard. Tested by executing the
// actual migration SQL against seeded rows (single source of truth).
const MIGRATION = join(process.cwd(), "src/server/db/migrations/0028_backfill_contact_names.sql");

async function runBackfill() {
  const text = await readFile(MIGRATION, "utf8");
  await sql.unsafe(text);
}

describe("0028 backfill mis-split contact names", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("US1: splits mis-split names at the last space, leaving the display name unchanged", async () => {
    const [chuck] = await db.insert(contacts).values(contactRow("Chuck Abell")).returning();
    const [david] = await db.insert(contacts).values(contactRow("David Van Buren")).returning();

    await runBackfill();

    const c = await db.query.contacts.findFirst({ where: eq(contacts.id, chuck!.id) });
    expect(c?.firstName).toBe("Chuck");
    expect(c?.lastName).toBe("Abell");
    expect(c?.displayName).toBe("Chuck Abell"); // unchanged
    expect(c?.dedupNormalized).toBe(chuck!.dedupNormalized); // dedup key unchanged
    expect(c?.nameNormalized).toBe(chuck!.nameNormalized); // search key unchanged

    const d = await db.query.contacts.findFirst({ where: eq(contacts.id, david!.id) });
    expect(d?.firstName).toBe("David Van"); // last-space split keeps the compound given/first part
    expect(d?.lastName).toBe("Buren");
    expect(d?.displayName).toBe("David Van Buren"); // unchanged
  });

  it("US2: leaves already-structured + mononym contacts untouched, preserves count, and is idempotent", async () => {
    const { contactId: adaId } = await makeContactWithEmail({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@ex.com",
    });
    const [madonna] = await db.insert(contacts).values(contactRow("Madonna")).returning();
    const [chuck] = await db.insert(contacts).values(contactRow("Chuck Abell")).returning();

    const countBefore = (await db.select().from(contacts)).length;

    await runBackfill();

    // Already-structured contact untouched.
    const ada = await db.query.contacts.findFirst({ where: eq(contacts.id, adaId) });
    expect(ada?.firstName).toBe("Ada");
    expect(ada?.lastName).toBe("Lovelace");

    // Mononym (no space) untouched.
    const m = await db.query.contacts.findFirst({ where: eq(contacts.id, madonna!.id) });
    expect(m?.firstName).toBe("Madonna");
    expect(m?.lastName).toBeNull();

    // No delete/merge.
    expect((await db.select().from(contacts)).length).toBe(countBefore);

    // Idempotent: a second run corrects nothing and never re-splits the already-corrected row.
    await runBackfill();
    const c = await db.query.contacts.findFirst({ where: eq(contacts.id, chuck!.id) });
    expect(c?.firstName).toBe("Chuck");
    expect(c?.lastName).toBe("Abell");

    // SC-001: no mis-split rows remain.
    const rows = await sql<{ n: number }[]>`
      select count(*)::int as n from contacts
      where last_name is null and btrim(first_name) like '% %'`;
    expect(rows[0]?.n).toBe(0);
  });
});
