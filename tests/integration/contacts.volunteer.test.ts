import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, jsonReqAs, ctx } from "./helpers/http";
import { makeActor } from "./helpers/factories";
import { db } from "@/server/db/client";
import { roleGrants } from "@/server/db/schema";
import { POST as CREATE } from "@/app/api/contacts/route";
import { PATCH as PATCH_CONTACT } from "@/app/api/contacts/[id]/route";

// File-level DB lifecycle (shared across the describes below — a single closeDb for the pool).
beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

async function seedContact(firstName = "Vol Test") {
  const res = await CREATE(
    jsonReq("POST", "/api/contacts", {
      firstName,
      email: { address: `${firstName.replace(/\s+/g, "").toLowerCase()}@example.com` },
    }),
    ctx(),
  );
  return (await res.json()).id as string;
}

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
  const createContact = seedContact;

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
    await PATCH_CONTACT(
      jsonReq("PATCH", `/api/contacts/${id}`, { isVolunteer: true }),
      ctx({ id }),
    );

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

// Feature 063 (M-R7 / FR-010): is_volunteer is the staff-access gate. Only a role.assign holder may
// change it; a contact.write-only viewer's change is silently ignored (the rest of the save applies).
describe("is_volunteer is governance-gated (feature 063)", () => {
  it("contact.write-only actor: isVolunteer is ignored, other edits still save (C1)", async () => {
    const id = await seedContact("Gate One");
    const mlm = await makeActor({
      email: "mlm@example.com",
      grants: [{ role: "mailing_list_manager" }], // contact.write, NOT role.assign
    });

    const res = await PATCH_CONTACT(
      jsonReqAs(mlm.token, "PATCH", `/api/contacts/${id}`, {
        lastName: "Smithe",
        isVolunteer: true,
      }),
      ctx({ id }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lastName).toBe("Smithe"); // the allowed edit persisted
    expect(body.isVolunteer).toBe(false); // the disallowed field was ignored, not honored
  });

  it("role.assign actor: isVolunteer toggle persists (C2)", async () => {
    const id = await seedContact("Gate Two");
    // Reaching this endpoint needs contact.write; changing is_volunteer needs role.assign. The person
    // who has both is the VP-also-mailing-list-manager (per the requirements: the VP officer is often
    // also the MLM). Grant both roles.
    const vpMlm = await makeActor({
      email: "vpmlm@example.com",
      grants: [{ role: "vice_president" }, { role: "mailing_list_manager" }],
    });

    const res = await PATCH_CONTACT(
      jsonReqAs(vpMlm.token, "PATCH", `/api/contacts/${id}`, { isVolunteer: true }),
      ctx({ id }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).isVolunteer).toBe(true);
  });
});
