import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { POST as CREATE } from "@/app/api/contacts/route";
import { PATCH as PATCH_CONTACT } from "@/app/api/contacts/[id]/route";

// FR-005a: volunteer flag + roles; roles only on volunteers.
describe("volunteer roles", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function createContact() {
    const res = await CREATE(
      jsonReq("POST", "/api/contacts", {
        firstName: "Vol Test",
        email: { address: "vol@example.com" },
      }),
      ctx(),
    );
    return (await res.json()).id as string;
  }

  it("assigns roles when the contact is marked volunteer", async () => {
    const id = await createContact();
    const res = await PATCH_CONTACT(
      jsonReq("PATCH", `/api/contacts/${id}`, {
        isVolunteer: true,
        volunteerRoles: ["door_attendant", "administrator"],
      }),
      ctx({ id }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isVolunteer).toBe(true);
    expect(body.volunteerRoles).toEqual(["door_attendant", "administrator"]);
  });

  it("rejects roles without volunteer flag (422 ROLES_REQUIRE_VOLUNTEER)", async () => {
    const id = await createContact();
    const res = await PATCH_CONTACT(
      jsonReq("PATCH", `/api/contacts/${id}`, {
        volunteerRoles: ["administrator"],
      }),
      ctx({ id }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("ROLES_REQUIRE_VOLUNTEER");
  });
});
