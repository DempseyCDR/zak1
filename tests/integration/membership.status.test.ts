import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { POST as CREATE } from "@/app/api/contacts/route";
import { POST as CREATE_MEMBERSHIP } from "@/app/api/memberships/route";
import { GET as GET_STATUS } from "@/app/api/contacts/[id]/membership-status/route";

// FR-009: membership-status read endpoint.
describe("GET /api/contacts/:id/membership-status", () => {
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

  it("returns 'never'/listMember=false for a contact with no membership", async () => {
    const id = await createContact("No Member", "nm@example.com");
    const res = await GET_STATUS(
      jsonReq("GET", `/api/contacts/${id}/membership-status`),
      ctx({ id }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("never");
    expect(body.listMember).toBe(false);
  });

  it("reflects 'current' after a membership is recorded, with recomputedAt set", async () => {
    const id = await createContact("Has Member", "hm@example.com");
    // Feature 068: dues are recorded against the payer at a chosen level; expiry is derived (FR-002).
    await CREATE_MEMBERSHIP(
      jsonReq("POST", "/api/memberships", {
        contactId: id,
        level: "individual",
        paymentDate: new Date().toISOString().slice(0, 10),
      }),
      ctx(),
    );
    const res = await GET_STATUS(
      jsonReq("GET", `/api/contacts/${id}/membership-status`),
      ctx({ id }),
    );
    const body = await res.json();
    expect(body.status).toBe("current");
    expect(body.listMember).toBe(true);
    expect(body.recomputedAt).toBeTruthy();
  });
});
