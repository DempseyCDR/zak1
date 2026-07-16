import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { db } from "@/server/db/client";
import { roleGrants } from "@/server/db/schema";
import { POST as CREATE } from "@/app/api/contacts/route";
import { PATCH as PATCH_CONTACT } from "@/app/api/contacts/[id]/route";

/**
 * The contact endpoint designates volunteers; it does NOT confer authority (feature 016).
 *
 * This file used to assert the opposite — that `PATCH /api/contacts/[id]` assigned
 * `volunteerRoles`, which was the ONLY write path to the role substrate. Migration 0021 retired that
 * column: roles became `role_grants` rows, because an array cannot carry scope, and granting became
 * the President/VP's job on the access screen.
 *
 * The file is kept (rather than deleted) pointed at the new boundary: authority must never leak back
 * into the contact endpoint. That is a real regression risk — re-adding `volunteerRoles` here would be
 * an easy "restore the old behavior" fix, and it would hand role assignment to anyone who can edit a
 * contact, which after this feature includes the Door Attendant at check-in.
 */
describe("contact endpoint: designation yes, authority no (FR-023)", () => {
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

  it("marks a contact as a volunteer (eligibility to sign in)", async () => {
    const id = await createContact();
    const res = await PATCH_CONTACT(
      jsonReq("PATCH", `/api/contacts/${id}`, { isVolunteer: true }),
      ctx({ id }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).isVolunteer).toBe(true);
  });

  it("does NOT confer any role — a designated volunteer holds zero grants", async () => {
    const id = await createContact();
    await PATCH_CONTACT(jsonReq("PATCH", `/api/contacts/${id}`, { isVolunteer: true }), ctx({ id }));

    // Designation is eligibility, not authority. This contact can sign in and holds the Organizer
    // base — read everything but contact PII, write nothing — until someone grants them a role.
    const grants = await db.select().from(roleGrants).where(eq(roleGrants.contactId, id));
    expect(grants).toEqual([]);
  });

  it("ignores a legacy volunteerRoles payload rather than assigning anything", async () => {
    const id = await createContact();
    const res = await PATCH_CONTACT(
      jsonReq("PATCH", `/api/contacts/${id}`, {
        isVolunteer: true,
        volunteerRoles: ["administrator"], // retired in 0021; no longer part of the schema
      }),
      ctx({ id }),
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).not.toHaveProperty("volunteerRoles");
    const grants = await db.select().from(roleGrants).where(eq(roleGrants.contactId, id));
    expect(grants).toEqual([]);
  });
});
