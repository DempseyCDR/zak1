import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { POST as CREATE } from "@/app/api/contacts/route";
import { POST as ADD_EMAIL } from "@/app/api/contacts/[id]/emails/route";

// FR-004, FR-004a
describe("email consent topics", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function createContact() {
    const res = await CREATE(
      jsonReq("POST", "/api/contacts", {
        displayName: "Consent Test",
        email: { address: "consent@example.com" },
      }),
      ctx(),
    );
    return (await res.json()).id as string;
  }

  it("defaults consent topics to ['contact_tracing']", async () => {
    const res = await CREATE(
      jsonReq("POST", "/api/contacts", {
        displayName: "Default Consent",
        email: { address: "dc@example.com" },
      }),
      ctx(),
    );
    const body = await res.json();
    expect(body.emails[0].consentTopics).toEqual(["contact_tracing"]);
  });

  it("persists multiple non-exclusive consent topics", async () => {
    const id = await createContact();
    const res = await ADD_EMAIL(
      jsonReq("POST", `/api/contacts/${id}/emails`, {
        address: "multi@example.com",
        consentTopics: ["contra", "english", "special_events"],
      }),
      ctx({ id }),
    );
    expect((await res.json()).consentTopics).toEqual(["contra", "english", "special_events"]);
  });

  it("treats do_not_contact as exclusive/overriding", async () => {
    const id = await createContact();
    const res = await ADD_EMAIL(
      jsonReq("POST", `/api/contacts/${id}/emails`, {
        address: "dnc@example.com",
        consentTopics: ["contra", "do_not_contact", "english"],
      }),
      ctx({ id }),
    );
    expect((await res.json()).consentTopics).toEqual(["do_not_contact"]);
  });

  it("rejects an empty consent set (422 CONSENT_TOPICS_REQUIRED)", async () => {
    const id = await createContact();
    const res = await ADD_EMAIL(
      jsonReq("POST", `/api/contacts/${id}/emails`, {
        address: "empty@example.com",
        consentTopics: [],
      }),
      ctx({ id }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("CONSENT_TOPICS_REQUIRED");
  });
});
