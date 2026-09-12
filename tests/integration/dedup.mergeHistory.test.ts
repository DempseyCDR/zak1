import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import {
  attendance,
  contactEmails,
  contacts,
  mergeAudit,
  mergeReversals,
  performers,
} from "@/server/db/schema";
import { contactRow, makeEvent } from "./helpers/factories";
import { mergeContacts } from "@/server/domain/dedup/mergeService";
import { undoMerge } from "@/server/domain/dedup/undoMergeService";
import {
  listMergesForContact,
  reversibilityOf,
} from "@/server/domain/dedup/mergeHistoryService";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

const contact = async (name: string) =>
  (await db.insert(contacts).values(contactRow(name)).returning())[0]!.id;

const mergeIdFor = async (mergedId: string) =>
  (await db.query.mergeAudit.findFirst({ where: eq(mergeAudit.mergedId, mergedId) }))!.id;

/** Merge a fresh pair and hand back the merge's id, plus both contacts. */
async function mergedPair(): Promise<{ mergeId: string; survivor: string; dupe: string }> {
  const survivor = await contact("Keep Me");
  const dupe = await contact("Drop Me");
  await db.insert(performers).values({ displayName: "Drop Me", contactId: dupe });
  const result = await mergeContacts(db, survivor, dupe, survivor);
  if (result.outcome !== "completed") throw new Error("expected completed");
  const row = await db.query.mergeAudit.findFirst({ where: eq(mergeAudit.mergedId, dupe) });
  return { mergeId: row!.id, survivor, dupe };
}

/**
 * Feature 074 (FR-007 to FR-011). Can this merge be undone, and if not, why not?
 *
 * One function answers this for both the history view and the undo route, because two paths asking
 * nearly the same question is how feature 072 produced a hold that closed and immediately reopened
 * forever. The verdict is computed every time and never stored: a stored flag would go stale the moment
 * the survivor is merged again.
 */
describe("the reversibility verdict (FR-007 to FR-010)", () => {
  it("says reversible for a merge recorded by this feature", async () => {
    const { mergeId } = await mergedPair();
    expect((await reversibilityOf(db, mergeId)).verdict).toBe("reversible");
  });

  it("says no_manifest for a merge recorded before this feature", async () => {
    const { mergeId } = await mergedPair();
    // Exactly the state of the 36 merges already on record: the merge happened, but nothing wrote down
    // what moved, and nothing can reconstruct it.
    await db
      .update(mergeAudit)
      .set({ reversalManifest: null })
      .where(eq(mergeAudit.id, mergeId));

    const result = await reversibilityOf(db, mergeId);
    expect(result.verdict).toBe("no_manifest");
  });

  it("says survivor_merged once the survivor has itself been merged away", async () => {
    const { mergeId, survivor } = await mergedPair();
    // A → B, then B → C. Reversing A → B now would return rows to a contact that is itself retired.
    const third = await contact("Final Survivor");
    const second = await mergeContacts(db, third, survivor, third);
    if (second.outcome !== "completed") throw new Error("expected completed");

    expect((await reversibilityOf(db, mergeId)).verdict).toBe("survivor_merged");
  });

  it("says contact_archived when either contact has been archived since", async () => {
    const first = await mergedPair();
    await db
      .update(contacts)
      .set({ archivedAt: new Date() })
      .where(eq(contacts.id, first.survivor));
    expect((await reversibilityOf(db, first.mergeId)).verdict).toBe("contact_archived");

    // And the other side: the retired contact archived after the merge blocks it just the same.
    await resetDb();
    const second = await mergedPair();
    await db.update(contacts).set({ archivedAt: new Date() }).where(eq(contacts.id, second.dupe));
    expect((await reversibilityOf(db, second.mergeId)).verdict).toBe("contact_archived");
  });

  it("says already_undone once a reversal has been recorded", async () => {
    const { mergeId } = await mergedPair();
    await db.insert(mergeReversals).values({ mergeAuditId: mergeId, actor: "someone" });
    expect((await reversibilityOf(db, mergeId)).verdict).toBe("already_undone");
  });

  it("throws rather than inventing a verdict for a merge that does not exist", async () => {
    // Not a verdict: the five verdicts describe a merge that EXISTS. A missing one is a 404, which is
    // how every other service in this codebase reports an entity that was never there.
    await expect(reversibilityOf(db, "00000000-0000-0000-0000-000000000000")).rejects.toThrow(
      /no longer exists/i,
    );
  });
});

/**
 * Feature 074, User Story 2 (FR-026, FR-027).
 *
 * An undo nobody can find is not an undo, and until now a merge left no visible trace on the record it
 * produced. This is the listing behind that block.
 */
describe("the merge history for a contact (FR-026, FR-027)", () => {
  it("lists merges into this contact, newest first, with who and when", async () => {
    const survivor = await contact("Keep Me");
    const older = await contact("Merged Earlier");
    const newer = await contact("Merged Later");
    for (const dupe of [older, newer]) {
      await db.insert(performers).values({ displayName: "dupe", contactId: dupe });
      const r = await mergeContacts(db, survivor, dupe, survivor);
      if (r.outcome !== "completed") throw new Error("expected completed");
    }
    // Age the first one so the ordering is unambiguous rather than resting on insert timing.
    await db.execute(sql`
      UPDATE merge_audit SET created_at = now() - interval '5 days' WHERE merged_id = ${older}
    `);

    const history = await listMergesForContact(db, survivor);

    expect(history.map((h) => h.mergedContact.displayName)).toEqual([
      "Merged Later",
      "Merged Earlier",
    ]);
    expect(history[1]!.ageDays).toBe(5);
    expect(history[0]!.actor).toBe(survivor);
    expect(history[0]!.verdict).toBe("reversible");
    expect(history[0]!.reason, "a reversible merge needs no explanation").toBeUndefined();
    expect(history[0]!.reversal).toBeNull();
  });

  it("shows only merges INTO this contact, not its own retirement", async () => {
    const survivor = await contact("Keep Me");
    const dupe = await contact("Drop Me");
    await db.insert(performers).values({ displayName: "Drop Me", contactId: dupe });
    const r = await mergeContacts(db, survivor, dupe, survivor);
    if (r.outcome !== "completed") throw new Error("expected completed");

    // The undo control belongs on the survivor's record, which is the only place the merge is listed.
    expect(await listMergesForContact(db, survivor)).toHaveLength(1);
    expect(await listMergesForContact(db, dupe)).toHaveLength(0);
  });

  it("shows the WHOLE chain on the final survivor, not just the last merge (FR-026)", async () => {
    // Found walking the §5 manual pass: three Burlingame contacts, A → B then B → C. All three sets of
    // emails end up on C, but C's history listed only B → C. A → B sits on B's record, and B is retired
    // and cannot be opened — so the inner merge was invisible and unreachable, and with it the
    // `survivor_merged` verdict that the undo route relies on.
    const a = await contact("Emily");
    const b = await contact("Amy");
    const c = await contact("Jacob");
    await db.insert(performers).values({ displayName: "Emily", contactId: a });
    const first = await mergeContacts(db, b, a, b);
    if (first.outcome !== "completed") throw new Error("expected completed");
    const second = await mergeContacts(db, c, b, c);
    if (second.outcome !== "completed") throw new Error("expected completed");

    const history = await listMergesForContact(db, c);

    expect(history, "the inner merge is missing from the final survivor's history").toHaveLength(2);
    // Newest first, which is also the order they must be undone in.
    expect(history.map((h) => h.mergedContact.displayName)).toEqual(["Amy", "Emily"]);
    // The outer merge can go now; the inner one cannot, and says why (FR-008, FR-028).
    expect(history[0]!.verdict).toBe("reversible");
    expect(history[1]!.verdict).toBe("survivor_merged");
    expect(history[1]!.reason).toMatch(/undo that later merge first/i);
    // An indirect merge must name the contact it actually went into, or the row reads as a lie:
    // Emily was merged into Amy, not into Jacob.
    expect(history[0]!.intoContact.displayName).toBe("Jacob");
    expect(history[1]!.intoContact.displayName).toBe("Amy");
  });

  it("keeps the chain visible as it unwinds", async () => {
    const a = await contact("Emily");
    const b = await contact("Amy");
    const c = await contact("Jacob");
    await db.insert(performers).values({ displayName: "Emily", contactId: a });
    const first = await mergeContacts(db, b, a, b);
    if (first.outcome !== "completed") throw new Error("expected completed");
    const second = await mergeContacts(db, c, b, c);
    if (second.outcome !== "completed") throw new Error("expected completed");

    // Undo the outer merge: Amy is live again, so the inner merge becomes actionable — and moves to
    // Amy's record, which is now openable.
    await undoMerge(db, (await listMergesForContact(db, c))[0]!.mergeId, c, { canAssignRoles: true });

    expect(await listMergesForContact(db, c)).toHaveLength(1); // the undone outer merge
    const onB = await listMergesForContact(db, b);
    expect(onB).toHaveLength(1);
    expect(onB[0]!.mergedContact.displayName).toBe("Emily");
    expect(onB[0]!.verdict, "the inner merge should now be reversible").toBe("reversible");
  });

  it("reports a pre-feature merge with its reason and no action (FR-007, FR-028)", async () => {
    const { mergeId, survivor } = await mergedPair();
    await db.update(mergeAudit).set({ reversalManifest: null }).where(eq(mergeAudit.id, mergeId));

    const [entry] = await listMergesForContact(db, survivor);
    expect(entry?.verdict).toBe("no_manifest");
    // FR-028: the reason has to travel with the verdict, or the UI has nothing to say instead of a
    // button. This is the state of every merge already in the database.
    expect(entry?.reason).toMatch(/recorded before undo existed/i);
  });

  it("reports a reversal alongside the merge it undid (FR-021)", async () => {
    const { mergeId, survivor } = await mergedPair();
    await db
      .insert(mergeReversals)
      .values({ mergeAuditId: mergeId, actor: survivor, skipped: [{ table: "attendance" }] });

    const [entry] = await listMergesForContact(db, survivor);
    expect(entry?.verdict).toBe("already_undone");
    expect(entry?.reversal?.actor).toBe(survivor);
    expect(entry?.reversal?.skipped).toHaveLength(1);
  });

  it("counts activity since the merge over the closed table set, and nothing else", async () => {
    const survivor = await contact("Keep Me");
    const dupe = await contact("Drop Me");
    const before = await makeEvent({ eventDate: "2026-01-01" });
    // Rows that pre-date the merge must NOT count: the number answers "what has happened since?".
    await db.insert(attendance).values({ eventId: before.id, contactId: dupe });
    await db.insert(performers).values({ displayName: "Drop Me", contactId: dupe });

    const r = await mergeContacts(db, survivor, dupe, survivor);
    if (r.outcome !== "completed") throw new Error("expected completed");
    const mergeId = await mergeIdFor(dupe);
    // Build a real timeline rather than only backdating the merge: the pre-existing check-in has to
    // pre-date the merge, otherwise it counts as activity "since" it purely because the test made both
    // rows in the same second. `created_at` records when the ROW was made, not when it was attached.
    await db.execute(sql`UPDATE attendance SET created_at = now() - interval '10 days'`);
    await db.execute(sql`
      UPDATE merge_audit SET created_at = now() - interval '2 days' WHERE id = ${mergeId}
    `);

    expect((await listMergesForContact(db, survivor))[0]!.activitySince).toBe(0);

    // Two counted tables, one row each.
    const later = await makeEvent({ eventDate: "2026-02-02" });
    await db.insert(attendance).values({ eventId: later.id, contactId: survivor });
    await db.insert(contactEmails).values({ contactId: survivor, email: "new@example.com" });
    // And one in a table deliberately OUTSIDE the set — a performer record is not activity by a person.
    await db.insert(performers).values({ displayName: "Another", contactId: survivor });

    expect(
      (await listMergesForContact(db, survivor))[0]!.activitySince,
      "activitySince counted a table outside its closed set",
    ).toBe(2);
  });
});

describe("reversibility has no expiry date (FR-011)", () => {
  it("stays reversible however old the merge is", async () => {
    const { mergeId } = await mergedPair();
    // Two years back — past any retention window anyone would plausibly propose. The Chris Scott merge
    // was found long after the fact, which is why a cut-off was rejected rather than merely omitted.
    await db.execute(sql`
      UPDATE merge_audit SET created_at = now() - interval '730 days' WHERE id = ${mergeId}
    `);

    const result = await reversibilityOf(db, mergeId);
    expect(result.verdict, "an age-based cut-off has crept in").toBe("reversible");
  });
});
