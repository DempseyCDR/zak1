import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { contactEmails, contacts, mergeAudit } from "@/server/db/schema";
import { POST as CREATE } from "@/app/api/contacts/route";
import { POST as ADD_EMAIL } from "@/app/api/contacts/[id]/emails/route";
import { POST as MERGE } from "@/app/api/dedup/merge/route";

// FR-011, FR-012, FR-013
describe("POST /api/dedup/merge", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function createContact(name: string, address: string) {
    const res = await CREATE(
      jsonReq("POST", "/api/contacts", { firstName: name, email: { address } }),
      ctx(),
    );
    return (await res.json()).id as string;
  }

  it("re-links related records, soft-retires the merged contact, and writes a merge audit", async () => {
    const canonicalId = await createContact("John Smith", "john@example.com");
    const mergedId = await createContact("Jon Smith", "jon@example.com");
    // give the merged contact a second email to re-link
    await ADD_EMAIL(
      jsonReq("POST", `/api/contacts/${mergedId}/emails`, { address: "jon.alt@example.com" }),
      ctx({ id: mergedId }),
    );

    const res = await MERGE(jsonReq("POST", "/api/dedup/merge", { canonicalId, mergedId }), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.canonicalId).toBe(canonicalId);
    expect(body.relinkedCounts.contact_emails).toBe(2);

    // merged contact soft-retired
    const merged = await db.query.contacts.findFirst({ where: eq(contacts.id, mergedId) });
    expect(merged?.mergedIntoId).toBe(canonicalId);

    // all emails now under canonical
    const emails = await db
      .select()
      .from(contactEmails)
      .where(eq(contactEmails.contactId, canonicalId));
    expect(emails).toHaveLength(3);

    // audit written
    const audits = await db
      .select()
      .from(mergeAudit)
      .where(eq(mergeAudit.canonicalId, canonicalId));
    expect(audits).toHaveLength(1);
    expect(audits[0]?.actor).toBeTruthy();
  });

  it("rejects merging an already-merged contact with 409 ALREADY_MERGED", async () => {
    const a = await createContact("Ann Lee", "ann@example.com");
    const b = await createContact("Anne Lee", "anne@example.com");
    await MERGE(jsonReq("POST", "/api/dedup/merge", { canonicalId: a, mergedId: b }), ctx());

    const res = await MERGE(
      jsonReq("POST", "/api/dedup/merge", { canonicalId: a, mergedId: b }),
      ctx(),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("ALREADY_MERGED");
  });
});
