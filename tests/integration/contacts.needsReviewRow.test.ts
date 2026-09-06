import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts } from "@/server/db/schema";
import { makeBaseActor, makeContactWithEmail } from "./helpers/factories";
import { ctx, jsonReqAs } from "./helpers/http";
import { GET as LIST_CONTACTS } from "@/app/api/contacts/route";
import { createContact, listNeedsReview } from "@/server/domain/contacts/contactService";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

const flag = async (id: string) =>
  db.update(contacts).set({ needsReview: true }).where(eq(contacts.id, id));

/**
 * Feature 069 (FR-001a / FR-005). "Clear this record" is a judgement that the record is complete enough,
 * so the row has to show what that judgement rests on. Until this feature the queue projected only
 * `SEARCH_COLS` — name, status, pronouns — with no phone, no email and no timestamps, which meant the
 * only honest thing Mel could do with a row was open it.
 */
describe("the needs-review row carries what its decision depends on", () => {
  it("shows how the contact is reached and when the record was created and last changed", async () => {
    const c = await makeContactWithEmail({
      firstName: "Dana",
      lastName: "Ash",
      email: "dana@example.com",
      phone: "+15855550100",
    });
    await flag(c.contactId);

    const { items } = await listNeedsReview(db);
    const row = items.find((r) => r.id === c.contactId)!;
    expect(row.emails).toEqual(["dana@example.com"]);
    expect(row.phone).toBe("+15855550100");
    expect(row.createdAt).toBeTruthy();
    expect(row.updatedAt).toBeTruthy();
  });

  it("marks a reachable record safe to clear from the row, and a sparse one not (FR-005)", async () => {
    const full = await makeContactWithEmail({
      firstName: "Reach",
      lastName: "Able",
      email: "reach@example.com",
    });
    const sparse = await createContact(db, { firstName: "Nameonly" });
    await flag(full.contactId);
    await flag(sparse.id);

    const { items } = await listNeedsReview(db);
    expect(items.find((r) => r.id === full.contactId)?.safeToClear).toBe(true);
    // Nothing but a first name: the decision depends on facts the row cannot show, so it must be opened.
    expect(items.find((r) => r.id === sparse.id)?.safeToClear).toBe(false);
  });

  it("reports the DERIVED membership standing, as the search rows already do", async () => {
    const c = await createContact(db, { firstName: "Stale", lastName: "Cache" });
    await db
      .update(contacts)
      .set({ needsReview: true, membershipStatus: "current" })
      .where(eq(contacts.id, c.id));

    const { items } = await listNeedsReview(db);
    // No membership account exists, so the truth is "never" whatever the cached column says.
    expect(items.find((r) => r.id === c.id)?.membershipStatus).toBe("never");
  });
});

/**
 * Feature 069 put PII on these rows for the first time. `projectContact` is a DENYLIST — a new field
 * carrying an address or a phone number is exposed by default — and the review queue rides a `base`
 * route, so without projection every volunteer would read what the record page withholds from them.
 */
describe("the needs-review queue withholds PII from a volunteer who may not read it", () => {
  it("strips phone and emails, and says the row is not resolvable in place", async () => {
    const c = await makeContactWithEmail({
      firstName: "Dana",
      lastName: "Ash",
      email: "dana@example.com",
      phone: "+15855550100",
    });
    await flag(c.contactId);

    const base = await makeBaseActor("plain-volunteer@example.com");
    const res = await LIST_CONTACTS(
      jsonReqAs(base.token, "GET", "/api/contacts?needsReview=1"),
      ctx(),
    );
    const row = (await res.json()).items.find((r: { id: string }) => r.id === c.contactId);
    expect(row.phone).toBeNull();
    expect(row.emails).toEqual([]);
    // The flag describes the row THIS reader gets: nothing on it, so nothing to judge from it.
    expect(row.safeToClear).toBe(false);
  });
});
