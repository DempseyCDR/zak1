import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contactRow } from "./helpers/factories";
import { auditEvents, contacts, officers } from "@/server/db/schema";
import { setOfficer, listContactRoles } from "@/server/domain/org/officerService";

// Feature 055 (P7-R12): the officer designation + PII-gated board projection.
describe("officerService", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function makeContact(first: string, last: string): Promise<string> {
    const [row] = await db
      .insert(contacts)
      .values({ ...contactRow(`${first} ${last}`), firstName: first, lastName: last })
      .returning();
    return row!.id;
  }

  it("assigns an officer; the board projection shows name+role+alias and NO contact PII", async () => {
    const jane = await makeContact("Jane", "Doe");
    await setOfficer(db, "treasurer", jane, null);

    const board = await listContactRoles(db);
    const treasurer = board.find((o) => o.roleName === "Treasurer")!;
    expect(treasurer.name).toBe("Jane Doe");
    expect(treasurer.emailAlias).toBe("treasurer@cdrochester.org");
    // vacant seats show role+alias with no name
    expect(board.find((o) => o.roleName === "President")!.name).toBeNull();
    // the merged directory also includes non-board function aliases (name always null)
    const info = board.find((o) => o.emailAlias === "info@cdrochester.org")!;
    expect(info.name).toBeNull();
    // PII gate: only name/role/alias on the projection
    expect(Object.keys(treasurer).sort()).toEqual(["emailAlias", "name", "roleName"]);

    const kinds = await db
      .select({ kind: auditEvents.kind })
      .from(auditEvents)
      .where(eq(auditEvents.kind, "officer.set"));
    expect(kinds.length).toBe(1);
  });

  it("reassigning a role replaces the holder (one row per role); clearing empties it", async () => {
    const jane = await makeContact("Jane", "Doe");
    const bob = await makeContact("Bob", "Roe");
    await setOfficer(db, "treasurer", jane, null);
    await setOfficer(db, "treasurer", bob, null);

    const rows = await db.select().from(officers).where(eq(officers.roleKey, "treasurer"));
    expect(rows.length).toBe(1);
    expect((await listContactRoles(db)).find((o) => o.roleName === "Treasurer")!.name).toBe(
      "Bob Roe",
    );

    await setOfficer(db, "treasurer", null, null);
    expect(await db.select().from(officers).where(eq(officers.roleKey, "treasurer"))).toEqual([]);
  });

  it("rejects a non-board role key", async () => {
    const jane = await makeContact("Jane", "Doe");
    await expect(setOfficer(db, "info", jane, null)).rejects.toThrow(); // exists but not a board seat
    await expect(setOfficer(db, "nope", jane, null)).rejects.toThrow(); // unknown
  });
});
