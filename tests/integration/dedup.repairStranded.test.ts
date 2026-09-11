import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { attendance, contacts, performers } from "@/server/db/schema";
import { contactRow, makeEvent } from "./helpers/factories";
import { repairStrandedMerges } from "@/server/domain/dedup/repairStrandedMerges";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

const contact = async (name: string) =>
  (await db.insert(contacts).values(contactRow(name)).returning())[0]!.id;

const retireInto = async (merged: string, survivor: string) =>
  db.update(contacts).set({ mergedIntoId: survivor }).where(eq(contacts.id, merged));

/**
 * Feature 072 (FR-015). Correcting the merge does not move rows that earlier merges left behind — nine
 * of them, including the six performers that are the reason the Booker cannot email Zak Spath today.
 *
 * Written as a routine rather than SQL inside a migration for one reason: the test database starts empty,
 * so a backfill embedded in a migration could never be exercised against realistic input. Feature 068
 * made the same call for `migrateToAccounts`, and the two properties below are exactly why it matters.
 */
describe("repairing records stranded by past merges (FR-015)", () => {
  it("re-points a stranded record at its survivor", async () => {
    const survivor = await contact("Rich Dempsey");
    const stranded = await contact("Richard C Dempsey");
    await db.insert(performers).values({ displayName: "Richard C Dempsey", contactId: stranded });
    await retireInto(stranded, survivor);

    const report = await repairStrandedMerges(db);
    expect(report.performers).toBe(1);

    const p = await db.query.performers.findFirst({
      where: eq(performers.displayName, "Richard C Dempsey"),
    });
    expect(p?.contactId).toBe(survivor);
  });

  it("follows a merge CHAIN to the final live contact, not one hop", async () => {
    // Three such chains exist in the club's data: a contact merged into a target that was itself later
    // merged. A single-hop `SET contact_id = merged_into_id` would leave the record pointing at another
    // retired contact — re-creating the very condition being repaired.
    const finalSurvivor = await contact("Chris Cassidy");
    const middle = await contact("Chris Sharon Cassidy");
    const stranded = await contact("Sharon and Chris Cassidy");
    await db.insert(performers).values({ displayName: "Cassidy", contactId: stranded });
    await retireInto(middle, finalSurvivor);
    await retireInto(stranded, middle);

    await repairStrandedMerges(db);

    const p = await db.query.performers.findFirst({ where: eq(performers.displayName, "Cassidy") });
    expect(p?.contactId).toBe(finalSurvivor);
  });

  it("EXCLUDES records on an archived contact — there is no survivor to move to", async () => {
    const archived = await contact("Retired Member");
    await db.insert(performers).values({ displayName: "Retired Member", contactId: archived });
    await db.update(contacts).set({ archivedAt: new Date() }).where(eq(contacts.id, archived));

    const report = await repairStrandedMerges(db);
    expect(report.performers).toBe(0);

    const p = await db.query.performers.findFirst({
      where: eq(performers.displayName, "Retired Member"),
    });
    expect(p?.contactId).toBe(archived);
  });

  it("tolerates a collision by dropping the duplicate", async () => {
    const survivor = await contact("Attended Once");
    const stranded = await contact("Attended Twice");
    const evt = await makeEvent();
    await db.insert(attendance).values([
      { eventId: evt.id, contactId: survivor },
      { eventId: evt.id, contactId: stranded },
    ]);
    await retireInto(stranded, survivor);

    await repairStrandedMerges(db);

    const rows = await db.select().from(attendance).where(eq(attendance.eventId, evt.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.contactId).toBe(survivor);
  });

  it("is idempotent — a second run finds nothing to do", async () => {
    const survivor = await contact("Keep");
    const stranded = await contact("Stranded");
    await db.insert(performers).values({ displayName: "Stranded", contactId: stranded });
    await retireInto(stranded, survivor);

    await repairStrandedMerges(db);
    const second = await repairStrandedMerges(db);
    expect(Object.values(second).every((n) => n === 0)).toBe(true);
  });

  it("leaves the audit trail alone — it still names the retired contact (FR-003)", async () => {
    const survivor = await contact("Survivor");
    const stranded = await contact("Retired");
    await retireInto(stranded, survivor);

    await repairStrandedMerges(db);
    const row = await db.query.contacts.findFirst({ where: eq(contacts.id, stranded) });
    // The retirement marker itself is structural and is never rewritten.
    expect(row?.mergedIntoId).toBe(survivor);
  });
});
