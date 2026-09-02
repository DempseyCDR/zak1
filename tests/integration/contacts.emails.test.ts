import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, jsonReqAs, ctx } from "./helpers/http";
import { makeActor } from "./helpers/factories";
import { POST as CREATE } from "@/app/api/contacts/route";
import { POST as ADD_EMAIL } from "@/app/api/contacts/[id]/emails/route";
import { PATCH as PATCH_EMAIL } from "@/app/api/contacts/[id]/emails/[emailId]/route";
import { GET as CAPABILITIES } from "@/app/api/me/capabilities/route";

// FR-002, FR-002a
describe("contact emails", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function createContact() {
    const res = await CREATE(
      jsonReq("POST", "/api/contacts", {
        firstName: "Grace Hopper",
        email: { address: "grace@example.com" },
      }),
      ctx(),
    );
    return (await res.json()).id as string;
  }

  it("defaults purposes to ['personal'] when omitted", async () => {
    const res = await CREATE(
      jsonReq("POST", "/api/contacts", {
        firstName: "Default Purpose",
        email: { address: "dp@example.com" },
      }),
      ctx(),
    );
    const body = await res.json();
    expect(body.emails[0].purposes).toEqual(["personal"]);
  });

  it("adds a second email with multiple purposes", async () => {
    const id = await createContact();
    const res = await ADD_EMAIL(
      jsonReq("POST", `/api/contacts/${id}/emails`, {
        address: "grace.booking@example.com",
        purposes: ["personal", "booking"],
      }),
      ctx({ id }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.purposes).toEqual(["personal", "booking"]);
  });

  it("rejects an empty purposes set with 422 PURPOSES_REQUIRED", async () => {
    const id = await createContact();
    const res = await ADD_EMAIL(
      jsonReq("POST", `/api/contacts/${id}/emails`, {
        address: "x@example.com",
        purposes: [],
      }),
      ctx({ id }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("PURPOSES_REQUIRED");
  });

  // Feature 066 (M-R13): the email address is editable on patch.
  it("patchEmail sets a new address (C1)", async () => {
    const created = await CREATE(
      jsonReq("POST", "/api/contacts", {
        firstName: "Addr Edit",
        email: { address: "old@example.com" },
      }),
      ctx(),
    ).then((r) => r.json());
    const cid = created.id as string;
    const eid = created.emails[0].id as string;
    const res = await PATCH_EMAIL(
      jsonReq("PATCH", `/api/contacts/${cid}/emails/${eid}`, { email: "new@example.com" }),
      ctx({ id: cid, emailId: eid }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).email).toBe("new@example.com");
  });

  // Feature 066: the editor learns whether to offer email-edit controls.
  it("capabilities reports contactMailingWrite per grants (C7)", async () => {
    const mlm = await makeActor({
      email: "mlm@example.com",
      grants: [{ role: "mailing_list_manager" }],
    });
    const base = await makeActor({ email: "base@example.com" });
    const mlmCaps = await (
      await CAPABILITIES(jsonReqAs(mlm.token, "GET", "/api/me/capabilities"), ctx())
    ).json();
    const baseCaps = await (
      await CAPABILITIES(jsonReqAs(base.token, "GET", "/api/me/capabilities"), ctx())
    ).json();
    expect(mlmCaps.contactMailingWrite).toBe(true);
    expect(baseCaps.contactMailingWrite).toBe(false);
  });

  // Feature 066 (M-R15.3 / F1): a colliding active address is a dedup signal naming the other contact.
  it("patching an address active on another contact raises EMAIL_ACTIVE_ELSEWHERE (C2)", async () => {
    await CREATE(
      jsonReq("POST", "/api/contacts", {
        firstName: "Alice Anderson",
        email: { address: "shared@example.com" },
      }),
      ctx(),
    );
    const bob = await CREATE(
      jsonReq("POST", "/api/contacts", {
        firstName: "Bob Brown",
        email: { address: "bob@example.com" },
      }),
      ctx(),
    ).then((r) => r.json());
    const res = await PATCH_EMAIL(
      jsonReq("PATCH", `/api/contacts/${bob.id}/emails/${bob.emails[0].id}`, {
        email: "shared@example.com",
      }),
      ctx({ id: bob.id, emailId: bob.emails[0].id }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("EMAIL_ACTIVE_ELSEWHERE");
    expect(body.error.other.displayName).toBe("Alice Anderson");
    // Nothing changed: the pre-write check throws before the update (no partial write).
  });

  // Feature 066 (M-R15.1): patching consent topics collapses do_not_contact to exclusive (server lock, C3).
  it("patching consentTopics with do_not_contact collapses to {do_not_contact} (C3)", async () => {
    const created = await CREATE(
      jsonReq("POST", "/api/contacts", {
        firstName: "DNC Test",
        email: { address: "dnc@example.com", consentTopics: ["contra"] },
      }),
      ctx(),
    ).then((r) => r.json());
    const res = await PATCH_EMAIL(
      jsonReq("PATCH", `/api/contacts/${created.id}/emails/${created.emails[0].id}`, {
        consentTopics: ["contra", "do_not_contact"],
      }),
      ctx({ id: created.id, emailId: created.emails[0].id }),
    );
    expect((await res.json()).consentTopics).toEqual(["do_not_contact"]);
  });

  // Feature 066 (M-R15.4): a login email is refused on a non-volunteer (server lock, C4).
  it("setting isLogin on a non-volunteer email is refused (C4)", async () => {
    const created = await CREATE(
      jsonReq("POST", "/api/contacts", {
        firstName: "Not Volunteer",
        email: { address: "nv@example.com" },
      }),
      ctx(),
    ).then((r) => r.json()); // createContact makes a non-volunteer
    const res = await PATCH_EMAIL(
      jsonReq("PATCH", `/api/contacts/${created.id}/emails/${created.emails[0].id}`, {
        isLogin: true,
      }),
      ctx({ id: created.id, emailId: created.emails[0].id }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("LOGIN_NOT_PERMITTED");
  });
});
