import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { statusChangeAudit } from "@/server/db/schema";
import { POST as CREATE } from "@/app/api/contacts/route";
import { POST as CREATE_MEMBERSHIP } from "@/app/api/memberships/route";
import { createPayer } from "@/server/domain/membership/membershipService";

// FR-009, FR-013
describe("POST /api/memberships", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function setup() {
    const res = await CREATE(
      jsonReq("POST", "/api/contacts", {
        displayName: "Member One",
        email: { address: "m1@example.com" },
      }),
      ctx(),
    );
    const contactId = (await res.json()).id as string;
    const payer = await createPayer(db, { name: "Member One", contactId });
    return { contactId, payerId: payer.id };
  }

  it("sets status to 'current' and writes a status-change audit row", async () => {
    const { contactId, payerId } = await setup();
    const res = await CREATE_MEMBERSHIP(
      jsonReq("POST", "/api/memberships", { contactId, payerId, expiryDate: "2030-01-01" }),
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
