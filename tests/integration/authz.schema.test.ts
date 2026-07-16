import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { sql } from "@/server/db/client";
import { makeVolunteerContact } from "./helpers/factories";

/**
 * Migration 0021's grant-scope constraints (FR-005, FR-006, FR-007).
 *
 * Written against RAW SQL rather than the Drizzle schema on purpose: these are database constraints,
 * and asserting them through the ORM would test the mapping instead of the rule. It also lets the test
 * exist before `schema/authz.ts` does, which is what Principle I asks for.
 *
 * Scope is not a column — it is the SHAPE of the row (data-model.md §3):
 *   series_id NULL, group_id NULL  → club-wide
 *   series_id set,  group_id NULL  → per-series
 *   series_id NULL, group_id set   → per-event-group
 * Both set is meaningless, so the CHECK forbids it.
 */

/** Insert a grant with the given scope, returning nothing; throws on constraint violation. */
async function insertGrant(opts: {
  contactId: string;
  role?: string;
  seriesId?: string | null;
  groupId?: string | null;
}): Promise<void> {
  const role = opts.role ?? "booker";
  await sql`
    INSERT INTO role_grants (contact_id, role, series_id, group_id)
    VALUES (${opts.contactId}, ${role}::role, ${opts.seriesId ?? null}, ${opts.groupId ?? null})
  `;
}

async function aSeriesId(): Promise<string> {
  const [row] = await sql<{ id: string }[]>`SELECT id FROM series LIMIT 1`;
  if (!row) throw new Error("no series seeded");
  return row.id;
}

async function anEventGroupId(): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO event_groups (name) VALUES ('Thanksgiving 2026') RETURNING id
  `;
  if (!row) throw new Error("event group insert failed");
  return row.id;
}

describe("role_grants scope constraints (FR-005, FR-006, FR-007)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("accepts all three scope shapes: club-wide, per-series, per-event-group", async () => {
    const { contactId } = await makeVolunteerContact({
      firstName: "Ada",
      lastName: "Booker",
      email: "ada@cdrochester.org",
    });
    const seriesId = await aSeriesId();
    const groupId = await anEventGroupId();

    await insertGrant({ contactId, role: "president" }); // club-wide: both NULL
    await insertGrant({ contactId, role: "booker", seriesId });
    await insertGrant({ contactId, role: "door_attendant", groupId });

    // Scoped to THIS contact: resetDb seeds the harness actor a club-wide super_user grant, so an
    // unqualified count(*) silently includes it. Same trap as "Zztest Staff" and contact counts.
    const rows = await sql<{ n: string }[]>`
      SELECT count(*) AS n FROM role_grants WHERE contact_id = ${contactId}`;
    expect(rows[0]?.n).toBe("3");
  });

  it("REJECTS a grant carrying BOTH series_id and group_id (grant_scope_exclusive)", async () => {
    const { contactId } = await makeVolunteerContact({
      firstName: "Bad",
      lastName: "Scope",
      email: "bad@cdrochester.org",
    });
    const seriesId = await aSeriesId();
    const groupId = await anEventGroupId();

    // Series and group are ORTHOGONAL axes, not a hierarchy — a grant on both is not "narrower",
    // it is undefined. FR-007.
    await expect(insertGrant({ contactId, seriesId, groupId })).rejects.toThrow(
      /grant_scope_exclusive/,
    );
  });

  it("REJECTS a duplicate CLUB-WIDE grant of the same role (partial unique index)", async () => {
    const { contactId } = await makeVolunteerContact({
      firstName: "Dup",
      lastName: "Clubwide",
      email: "dup1@cdrochester.org",
    });

    await insertGrant({ contactId, role: "treasurer" });

    // The plain UNIQUE (contact_id, role, series_id, group_id) does NOT catch this: Postgres treats
    // NULLs as distinct, so (id,'treasurer',NULL,NULL) never equals itself. Only the partial unique
    // index on (contact_id, role) WHERE both scope columns are NULL closes it. data-model.md §3.
    await expect(insertGrant({ contactId, role: "treasurer" })).rejects.toThrow(
      /role_grants_unique|duplicate key/,
    );
  });

  it("REJECTS a second identical per-series grant (plain unique)", async () => {
    const { contactId } = await makeVolunteerContact({
      firstName: "Dup",
      lastName: "Series",
      email: "dup2@cdrochester.org",
    });
    const seriesId = await aSeriesId();

    await insertGrant({ contactId, role: "booker", seriesId });
    await expect(insertGrant({ contactId, role: "booker", seriesId })).rejects.toThrow(
      /duplicate key|role_grants_unique/,
    );
  });

  it("ALLOWS the same role at two different series (FR-005)", async () => {
    const { contactId } = await makeVolunteerContact({
      firstName: "Two",
      lastName: "Series",
      email: "two@cdrochester.org",
    });
    const ids = await sql<{ id: string }[]>`SELECT id FROM series LIMIT 2`;
    expect(ids.length).toBe(2); // guard: the assertion below is vacuous with one series

    await insertGrant({ contactId, role: "booker", seriesId: ids[0]!.id });
    await insertGrant({ contactId, role: "booker", seriesId: ids[1]!.id });

    const rows = await sql<{ n: string }[]>`
      SELECT count(*) AS n FROM role_grants WHERE contact_id = ${contactId}`;
    expect(rows[0]?.n).toBe("2");
  });

  it("REJECTS a grant whose series_id names no series (FK)", async () => {
    const { contactId } = await makeVolunteerContact({
      firstName: "Ghost",
      lastName: "Series",
      email: "ghost@cdrochester.org",
    });
    await expect(
      insertGrant({ contactId, seriesId: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it("does NOT constrain how many contacts hold a role — two Presidents are legal (FR-005c)", async () => {
    const a = await makeVolunteerContact({
      firstName: "First",
      lastName: "President",
      email: "pres1@cdrochester.org",
    });
    const b = await makeVolunteerContact({
      firstName: "Second",
      lastName: "President",
      email: "pres2@cdrochester.org",
    });

    await insertGrant({ contactId: a.contactId, role: "president" });
    await insertGrant({ contactId: b.contactId, role: "president" });

    const rows = await sql<{ n: string }[]>`
      SELECT count(*) AS n FROM role_grants WHERE role = 'president'`;
    expect(rows[0]?.n).toBe("2");
  });
});
