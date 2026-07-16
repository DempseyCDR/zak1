import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { POST as CREATE } from "@/app/api/contacts/route";
import { PATCH as PATCH_CONTACT } from "@/app/api/contacts/[id]/route";
import { POST as ADD_EMAIL } from "@/app/api/contacts/[id]/emails/route";

// FR-005: login email only on volunteer contacts.
describe("login email permission", () => {
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

  it("rejects a login email on a non-volunteer contact (422 LOGIN_NOT_PERMITTED)", async () => {
    const id = await createContact("Not Volunteer", "nv@example.com");
    const res = await ADD_EMAIL(
      jsonReq("POST", `/api/contacts/${id}/emails`, {
        address: "nv.login@example.com",
        isLogin: true,
      }),
      ctx({ id }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("LOGIN_NOT_PERMITTED");
  });

  it("allows a login email once the contact is a volunteer", async () => {
    const id = await createContact("Volunteer", "v@example.com");
    await PATCH_CONTACT(
      // Eligibility is what gates a login email — not a role. Roles left this endpoint in 0021.
      jsonReq("PATCH", `/api/contacts/${id}`, { isVolunteer: true }),
      ctx({ id }),
    );
    const res = await ADD_EMAIL(
      jsonReq("POST", `/api/contacts/${id}/emails`, {
        address: "v.login@example.com",
        isLogin: true,
      }),
      ctx({ id }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).isLogin).toBe(true);
  });
});
