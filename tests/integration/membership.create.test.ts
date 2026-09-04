import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { statusChangeAudit } from "@/server/db/schema";
import { POST as CREATE } from "@/app/api/contacts/route";
import { POST as CREATE_MEMBERSHIP } from "@/app/api/memberships/route";

// FR-009, FR-013
describe("POST /api/memberships", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function setup() {
    const res = await CREATE(
      jsonReq("POST", "/api/contacts", {
        firstName: "Member One",
        email: { address: "m1@example.com" },
      }),
      ctx(),
    );
    const contactId = (await res.json()).id as string;
    return { contactId };
  }

  it("sets status to 'current' and writes a status-change audit row", async () => {
    const { contactId } = await setup();
    // Feature 068: dues are recorded against the PAYER at a chosen level; the expiry is derived (FR-002),
    // and the payer indirection is gone — the payer IS the contact.
    const res = await CREATE_MEMBERSHIP(
      jsonReq("POST", "/api/memberships", {
        contactId,
        level: "individual",
        paymentDate: new Date().toISOString().slice(0, 10),
      }),
      ctx(),
    );
    expect(res.status).toBe(201);

    const audits = await db
      .select()
      .from(statusChangeAudit)
      .where(eq(statusChangeAudit.contactId, contactId));
    expect(audits).toHaveLength(1);
    expect(audits[0]?.fromStatus).toBe("never");
    expect(audits[0]?.toStatus).toBe("current");
    expect(audits[0]?.reason).toBe("membership_change");
  });
});
