import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { POST as CREATE } from "@/app/api/contacts/route";
import { POST as CREATE_MEMBERSHIP } from "@/app/api/memberships/route";
import { GET as GET_STATUS } from "@/app/api/contacts/[id]/membership-status/route";
import { createPayer } from "@/server/domain/membership/membershipService";

// FR-009: membership-status read endpoint.
describe("GET /api/contacts/:id/membership-status", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function createContact(name: string, address: string) {
    const res = await CREATE(
      jsonReq("POST", "/api/contacts", { displayName: name, email: { address } }),
      ctx(),
    );
    return (await res.json()).id as string;
  }

  it("returns 'never'/listMember=false for a contact with no membership", async () => {
    const id = await createContact("No Member", "nm@example.com");
    const res = await GET_STATUS(jsonReq("GET", `/api/contacts/${id}/membership-status`), ctx({ id }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("never");
    expect(body.listMember).toBe(false);
  });

  it("reflects 'current' after a membership is recorded, with recomputedAt set", async () => {
    const id = await createContact("Has Member", "hm@example.com");
    const payer = await createPayer(db, { name: "Has Member", contactId: id });
    await CREATE_MEMBERSHIP(
      jsonReq("POST", "/api/memberships", { contactId: id, payerId: payer.id, expiryDate: "2030-01-01" }),
      ctx(),
    );
    const res = await GET_STATUS(jsonReq("GET", `/api/contacts/${id}/membership-status`), ctx({ id }));
    const body = await res.json();
    expect(body.status).toBe("current");
    expect(body.listMember).toBe(true);
    expect(body.recomputedAt).toBeTruthy();
  });
});
