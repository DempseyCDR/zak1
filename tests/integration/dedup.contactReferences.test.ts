import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { ensureSchema, closeDb, db } from "./helpers/db";
import {
  CONTACT_REFERENCES,
  type ContactReferenceDisposition,
} from "@/server/domain/dedup/contactReferences";

beforeAll(ensureSchema);
afterAll(closeDb);

/**
 * Feature 072 (FR-002a). The parity guard.
 *
 * FR-002 states the rule — "move everything except the audit trail, so a kind of attachment added later
 * is carried by default" — but a rule nothing checks is an intention. This is what makes it true: the
 * guard reads the DATABASE, not a second hand-maintained list, so a new reference to a contact fails the
 * build until somebody classifies it.
 *
 * That is not hypothetical. Feature 068 replaced the membership tables and the merge went on relinking
 * the retired pair for two releases, because the only thing saying which tables to move was the merge
 * itself. This guard is the reason that cannot recur. It is the `routeInventory` pattern: read the thing,
 * don't restate it.
 *
 * Note the classification is per COLUMN, not per table — `dedup_rejections` has three references to
 * `contacts` and they do not all fall on the same side.
 */
type FkRow = { table_name: string; column_name: string };

async function foreignKeysIntoContacts(): Promise<FkRow[]> {
  const rows = await db.execute<FkRow>(sql`
    SELECT co.conrelid::regclass::text AS table_name, a.attname AS column_name
      FROM pg_constraint co
      JOIN unnest(co.conkey) WITH ORDINALITY k(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = co.conrelid AND a.attnum = k.attnum
     WHERE co.contype = 'f' AND co.confrelid = 'contacts'::regclass
     ORDER BY 1, 2
  `);
  return [...rows];
}

const key = (r: { table: string; column: string } | FkRow) =>
  "table" in r ? `${r.table}.${r.column}` : `${r.table_name}.${r.column_name}`;

describe("every reference to a contact is classified (FR-002a)", () => {
  it("classifies each foreign key into contacts exactly once", async () => {
    const inDatabase = (await foreignKeysIntoContacts()).map(key).sort();
    const classified = CONTACT_REFERENCES.map(key).sort();

    // Named, not counted: the failure message must say WHICH column nobody classified, or the guard
    // just tells you a number is wrong.
    const unclassified = inDatabase.filter((k) => !classified.includes(k));
    expect(
      unclassified,
      `unclassified reference(s) to contacts: ${unclassified.join(", ")}`,
    ).toEqual([]);

    // And the reverse: a reference that was REMOVED must not linger in the classification, or the merge
    // would keep trying to move a column that no longer exists.
    const stale = classified.filter((k) => !inDatabase.includes(k));
    expect(stale, `classified but no longer in the database: ${stale.join(", ")}`).toEqual([]);
  });

  it("gives every entry a known disposition and no duplicates", () => {
    const allowed: ContactReferenceDisposition[] = ["move", "leave", "structural"];
    for (const ref of CONTACT_REFERENCES) {
      expect(allowed, `${key(ref)} has an unknown disposition`).toContain(ref.disposition);
    }
    const keys = CONTACT_REFERENCES.map(key);
    expect(new Set(keys).size, "a reference is classified twice").toBe(keys.length);
  });

  it("classification is per COLUMN — dedup_rejections falls on both sides", () => {
    const find = (k: string) => CONTACT_REFERENCES.find((r) => key(r) === k);
    // The pair being judged stays with the judgement; who judged it is an actor record.
    expect(find("dedup_rejections.contact_a_id")?.disposition).toBe("leave");
    expect(find("dedup_rejections.rejected_by")?.disposition).toBe("leave");
    // Whereas a table can be split the other way: the merge pointer is neither.
    expect(find("contacts.merged_into_id")?.disposition).toBe("structural");
  });

  it("moves what a person owns and leaves what a person did", () => {
    const disposition = (k: string) => CONTACT_REFERENCES.find((r) => key(r) === k)?.disposition;
    // Attachments — the survivor inherits these.
    for (const k of [
      "performers.contact_id",
      "attendance.contact_id",
      "gate_sales.contact_id",
      "officers.contact_id",
      "venues.landlord_contact_id",
      "membership_captures.contact_id",
      "contact_emails.contact_id",
      "membership_accounts.payer_contact_id",
      "membership_members.contact_id",
      "role_grants.contact_id",
      "staff_identities.contact_id",
    ]) {
      expect(disposition(k), `${k} should move`).toBe("move");
    }
    // Actor records — rewriting these would falsify who did what.
    for (const k of [
      "status_change_audit.contact_id",
      "merge_audit.canonical_id",
      "merge_audit.merged_id",
      "audit_events.actor_contact_id",
      "held_merges.attempted_by",
      "contacts.volunteer_approved_by",
      "role_grants.granted_by",
    ]) {
      expect(disposition(k), `${k} should stay`).toBe("leave");
    }
  });
});

/**
 * Feature 074 (FR-001). A moved row has to be nameable, or it cannot be moved back.
 *
 * The obvious design — record each moved row's `id` — does not work: `membership_members` has a
 * COMPOSITE primary key and no `id` column at all, and its `contact_id` is simultaneously half that key
 * and the column the merge rewrites. So every moved reference declares the columns that identify one of
 * its rows, and these tests hold that declaration to the database's own definition of the key rather
 * than to a second hand-maintained list.
 */
type PkRow = { column_name: string };

async function primaryKeyColumns(table: string): Promise<string[]> {
  const rows = await db.execute<PkRow>(sql`
    SELECT a.attname AS column_name
      FROM pg_constraint co
      JOIN unnest(co.conkey) WITH ORDINALITY k(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = co.conrelid AND a.attnum = k.attnum
     WHERE co.contype = 'p' AND co.conrelid = ${table}::regclass
     ORDER BY k.ord
  `);
  return [...rows].map((r) => r.column_name);
}

describe("every moved reference declares its primary key (FR-001)", () => {
  const moved = CONTACT_REFERENCES.filter((r) => r.disposition === "move");

  it("declares a non-empty key on every moved reference", () => {
    for (const ref of moved) {
      // Named, not counted — the failure has to say which reference nobody gave a key.
      expect(ref.pk, `${key(ref)} declares no primary key, so a moved row cannot be named`).toBeTruthy();
      expect(ref.pk.length, `${key(ref)} declares an empty primary key`).toBeGreaterThan(0);
    }
  });

  it("declares exactly the key the database has", async () => {
    for (const ref of moved) {
      const actual = await primaryKeyColumns(ref.table);
      const declared = ref.pk.map((c) => c.name);
      expect(
        [...declared].sort(),
        `${key(ref)} declares [${declared.join(", ")}] but the table's key is [${actual.join(", ")}]`,
      ).toEqual([...actual].sort());
    }
  });

  it("membership_members is the composite case this field exists for", async () => {
    const ref = moved.find((r) => r.table === "membership_members");
    expect(ref?.pk.map((c) => c.name).sort()).toEqual(["account_id", "contact_id"]);
    // And it genuinely has no `id` — if one is ever added, the reasoning above should be revisited.
    expect(await primaryKeyColumns("membership_members")).not.toContain("id");
  });

  it("leave and structural entries declare no key — they are never moved", () => {
    for (const ref of CONTACT_REFERENCES.filter((r) => r.disposition !== "move")) {
      expect(
        "pk" in ref && ref.pk !== undefined,
        `${key(ref)} is ${ref.disposition} but declares a primary key it cannot use`,
      ).toBe(false);
    }
  });
});
