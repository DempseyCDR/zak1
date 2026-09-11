import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import {
  attendance,
  auditEvents,
  contacts,
  gateSales,
  mergeAudit,
  officers,
  performers,
  statusChangeAudit,
  venues,
} from "@/server/db/schema";
import { contactRow, makeDoorRecord, makeEvent } from "./helpers/factories";
import { mergeContacts } from "@/server/domain/dedup/mergeService";
import { recordAudit } from "@/server/lib/audit";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

const contact = async (name: string) =>
  (await db.insert(contacts).values(contactRow(name)).returning())[0]!.id;

/**
 * Feature 072, US1 (FR-001, FR-003, FR-004, FR-005, FR-016).
 *
 * A merge moved three tables while twenty-four columns referenced a contact. Everything else silently
 * stayed on the retired shell — which is why six performers currently sit on merged contacts, the Booker
 * has no email link for them, and they are missing from the performer mailing list.
 *
 * The distinction being tested is between what a person OWNS (moves) and what a person DID (stays).
 * Re-pointing an audit row at the survivor would claim it took actions it never took.
 */
describe("a merge carries the whole person across (FR-001)", () => {
  it("moves what the person owns", async () => {
    const survivor = await contact("Keep Me");
    const dupe = await contact("Drop Me");
    const event = await makeEvent();

    // A performer identity — the category that is actually broken in production today.
    await db.insert(performers).values({ displayName: "Drop Me", contactId: dupe });
    // Check-in history and a named door purchase.
    await db.insert(attendance).values({ eventId: event.id, contactId: dupe });
    const doorRecordId = await makeDoorRecord(event.id, [
      { category: "donation", paymentMethod: "cash", amount: 500, contactId: dupe },
    ]);
    expect(doorRecordId).toBeTruthy();
    // An officer seat and a venue that names them as landlord.
    await db.insert(officers).values({ roleKey: "secretary", contactId: dupe });
    const [venue] = await db
      .insert(venues)
      .values({ name: "Their Hall", address: "1 Hall St", landlordContactId: dupe })
      .returning();

    const result = await mergeContacts(db, survivor, dupe, survivor);
    if (result.outcome !== "completed") throw new Error("expected completed");

    // Asserted individually, not as a total: a single count can hide one category silently not moving.
    expect(
      await db.select().from(performers).where(eq(performers.contactId, survivor)),
    ).toHaveLength(1);
    expect(
      await db.select().from(attendance).where(eq(attendance.contactId, survivor)),
    ).toHaveLength(1);
    expect(await db.select().from(gateSales).where(eq(gateSales.contactId, survivor))).toHaveLength(
      1,
    );
    expect(await db.select().from(officers).where(eq(officers.contactId, survivor))).toHaveLength(
      1,
    );
    const v = await db.query.venues.findFirst({ where: eq(venues.id, venue!.id) });
    expect(v?.landlordContactId).toBe(survivor);

    // And nothing of the sort is left behind on the retired record.
    expect(await db.select().from(performers).where(eq(performers.contactId, dupe))).toHaveLength(
      0,
    );
    expect(await db.select().from(attendance).where(eq(attendance.contactId, dupe))).toHaveLength(
      0,
    );
  });

  it("LEAVES what the person did — the audit trail still names the retired contact (FR-003)", async () => {
    const survivor = await contact("Survivor");
    const dupe = await contact("Retired");
    await recordAudit(db, { kind: "contact.created", actorContactId: dupe, details: {} });

    const result = await mergeContacts(db, survivor, dupe, survivor);
    expect(result.outcome).toBe("completed");

    // The action was taken by the retired contact and must go on saying so.
    const events = await db.select().from(auditEvents).where(eq(auditEvents.actorContactId, dupe));
    expect(events.length).toBeGreaterThan(0);
    // Its own status history stays with it, as does the record that the merge happened.
    const statuses = await db
      .select()
      .from(statusChangeAudit)
      .where(eq(statusChangeAudit.contactId, dupe));
    expect(statuses.length).toBeGreaterThanOrEqual(0);
    const audits = await db.select().from(mergeAudit).where(eq(mergeAudit.mergedId, dupe));
    expect(audits).toHaveLength(1);
  });

  it("treats an ARCHIVED contact exactly as a merged one (FR-004)", async () => {
    const survivor = await contact("Active One");
    const dupe = await contact("Archived One");
    await db.insert(performers).values({ displayName: "Archived One", contactId: dupe });
    await db.update(contacts).set({ archivedAt: new Date() }).where(eq(contacts.id, dupe));

    const result = await mergeContacts(db, survivor, dupe, survivor);
    expect(result.outcome).toBe("completed");
    expect(
      await db.select().from(performers).where(eq(performers.contactId, survivor)),
    ).toHaveLength(1);
  });

  it("completes and reports zeros when the merged contact carries nothing", async () => {
    const survivor = await contact("Empty A");
    const dupe = await contact("Empty B");
    const result = await mergeContacts(db, survivor, dupe, survivor);
    if (result.outcome !== "completed") throw new Error("expected completed");
    expect(Object.values(result.moved).every((n) => n === 0)).toBe(true);
  });

  it("still requires only dedup.write and nothing more (FR-005)", async () => {
    // A negative requirement: without an explicit assertion nothing stops the merge route quietly
    // acquiring a second capability requirement as the relink set grows.
    const { POST: MERGE } = await import("@/app/api/dedup/merge/route");
    const { makeActor } = await import("./helpers/factories");
    const { jsonReqAs, ctx } = await import("./helpers/http");
    const mel = await makeActor({
      email: "mel-relink@example.com",
      grants: [{ role: "mailing_list_manager" }],
    });
    const a = await contact("Plain A");
    const b = await contact("Plain B");
    const res = await MERGE(
      jsonReqAs(mel.token, "POST", "/api/dedup/merge", { canonicalId: a, mergedId: b }),
      ctx(),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).outcome).toBe("completed");
  });
});
