import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts } from "@/server/db/schema";
import { contactRow } from "./helpers/factories";
import { jsonReq, ctx } from "./helpers/http";
import { patchContact } from "@/server/domain/contacts/contactService";
import { GET as CONTACTS } from "@/app/api/contacts/route";
import { POST as REVIEWED } from "@/app/api/contacts/[id]/reviewed/route";

// File-level DB lifecycle (single closeDb for the shared pool).
beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

async function seedFlagged(name: string): Promise<string> {
  const [row] = await db
    .insert(contacts)
    .values({ ...contactRow(name), needsReview: true })
    .returning();
  return row!.id;
}

// Feature 064: the needs-review filter/list, and the two ways the flag clears (auto on save when the
// record has contact data; and the manual Mark reviewed).
describe("needs-review filter + clears (feature 064)", () => {
  it("GET /api/contacts?needsReview=1 returns only flagged contacts (C1)", async () => {
    await seedFlagged("Amy Flag");
    await db.insert(contacts).values({ ...contactRow("Cara Clean"), needsReview: false });
    const res = await CONTACTS(jsonReq("GET", "/api/contacts?needsReview=1"), ctx());
    const body = await res.json();
    expect(body.items.map((i: { displayName: string }) => i.displayName)).toEqual(["Amy Flag"]);
  });

  it("patchContact clears needs_review once the record has a phone (C5)", async () => {
    const id = await seedFlagged("Nate NoInfo");
    await patchContact(db, id, { phone: "5855551234" });
    const row = await db.query.contacts.findFirst({ where: eq(contacts.id, id) });
    expect(row!.needsReview).toBe(false);
  });

  it("patchContact leaves needs_review set when still no email/phone (C6)", async () => {
    const id = await seedFlagged("Pat Pending");
    await patchContact(db, id, { pronouns: "they/them" });
    const row = await db.query.contacts.findFirst({ where: eq(contacts.id, id) });
    expect(row!.needsReview).toBe(true);
  });

  it("POST /api/contacts/:id/reviewed clears the flag with no email/phone (C7)", async () => {
    const id = await seedFlagged("Val Dismiss");
    const res = await REVIEWED(jsonReq("POST", `/api/contacts/${id}/reviewed`), ctx({ id }));
    expect(res.status).toBe(200);
    const row = await db.query.contacts.findFirst({ where: eq(contacts.id, id) });
    expect(row!.needsReview).toBe(false);
  });
});
