import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contactEmails, auditEvents } from "@/server/db/schema";
import { makeActor } from "./helpers/factories";
import { jsonReq, jsonReqAs, ctx } from "./helpers/http";
import { POST as CREATE } from "@/app/api/contacts/route";
import { DELETE as DELETE_EMAIL } from "@/app/api/contacts/[id]/emails/[emailId]/route";

// File-level DB lifecycle (single closeDb for the shared pool).
beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

async function seedContactWithEmail(): Promise<{ contactId: string; emailId: string }> {
  const body = await CREATE(
    jsonReq("POST", "/api/contacts", {
      firstName: "Del Test",
      email: { address: "del@example.com" },
    }),
    ctx(),
  ).then((r) => r.json());
  return { contactId: body.id, emailId: body.emails[0].id };
}

// Feature 066 (M-R17): hard-delete an email row, gated by contact.delete.unrestricted (super-user).
describe("email hard delete (feature 066)", () => {
  it("super-user (contact.delete.unrestricted) erases the row + audits (C5)", async () => {
    const { contactId, emailId } = await seedContactWithEmail();
    // The standing test session is a club-wide super_user → holds contact.delete.unrestricted.
    const res = await DELETE_EMAIL(
      jsonReq("DELETE", `/api/contacts/${contactId}/emails/${emailId}`),
      ctx({ id: contactId, emailId }),
    );
    expect(res.status).toBe(200);
    expect(
      await db.query.contactEmails.findFirst({ where: eq(contactEmails.id, emailId) }),
    ).toBeUndefined();
    const audit = await db.select().from(auditEvents).where(eq(auditEvents.kind, "email.deleted"));
    expect(audit.length).toBe(1);
  });

  it("a non-super-user (mailing-write only) is refused (C6)", async () => {
    const { contactId, emailId } = await seedContactWithEmail();
    const mlm = await makeActor({
      email: "mlm@example.com",
      grants: [{ role: "mailing_list_manager" }], // contact.mailing.write, NOT contact.delete.unrestricted
    });
    const res = await DELETE_EMAIL(
      jsonReqAs(mlm.token, "DELETE", `/api/contacts/${contactId}/emails/${emailId}`),
      ctx({ id: contactId, emailId }),
    );
    expect(res.status).toBe(403);
    expect(
      await db.query.contactEmails.findFirst({ where: eq(contactEmails.id, emailId) }),
    ).toBeTruthy();
  });
});
