import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { sql } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts } from "@/server/db/schema";
import { normalizePhone } from "@/server/domain/contacts/phone";

// Feature 032 (P5-R6) US3: the 0030 backfill normalizes existing phones (unparseable unchanged), and its
// result matches normalizePhone (parity — single source of truth), idempotently. Mirrors 027's 0028 test.
const MIGRATION = join(process.cwd(), "src/server/db/migrations/0030_normalize_contact_phones.sql");

// Raw inputs the directory might already hold (inserted directly, bypassing the normalized write path).
const RAW = [
  "(585) 555-1234",
  "585.555.1234",
  "5855551234",
  "1-585-555-1234",
  "+15855551234", // already canonical
  "+44 20 7946 0958", // non-US
  "585-1234 x89", // extension → raw
  "call Mary", // letters → raw
];

async function seedRaw(): Promise<{ id: string; raw: string }[]> {
  const rows = await db
    .insert(contacts)
    .values(
      RAW.map((raw, i) => ({
        firstName: `Seed${i}`,
        displayName: `Seed${i}`,
        nameNormalized: `seed${i}`,
        dedupNormalized: `seed${i}`,
        phone: raw, // stored raw on purpose
      })),
    )
    .returning({ id: contacts.id, phone: contacts.phone });
  return rows.map((r, i) => ({ id: r.id, raw: RAW[i]! }));
}

async function runMigration(): Promise<void> {
  await db.execute(sql.raw(readFileSync(MIGRATION, "utf8")));
}

async function phoneById(): Promise<Map<string, string | null>> {
  const rows = await db.select({ id: contacts.id, phone: contacts.phone }).from(contacts);
  return new Map(rows.map((r) => [r.id, r.phone]));
}

describe("0030 phone backfill (032 US3)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("normalizes existing phones to match normalizePhone; unparseable unchanged", async () => {
    const seeded = await seedRaw();
    await runMigration();
    const after = await phoneById();
    for (const { id, raw } of seeded) {
      expect(after.get(id)).toBe(normalizePhone(raw)); // parity with the write path
    }
    // Spot-check the two edge cases stay raw.
    const byRaw = new Map(seeded.map((s) => [s.raw, s.id]));
    expect(after.get(byRaw.get("585-1234 x89")!)).toBe("585-1234 x89");
    expect(after.get(byRaw.get("call Mary")!)).toBe("call Mary");
  });

  it("is idempotent — re-running changes nothing", async () => {
    await seedRaw();
    await runMigration();
    const once = await phoneById();
    await runMigration();
    const twice = await phoneById();
    expect(twice).toEqual(once);
  });
});
