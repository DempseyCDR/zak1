import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { POST as CREATE } from "@/app/api/contacts/route";
import { POST as ADD_EMAIL } from "@/app/api/contacts/[id]/emails/route";

// FR-002, FR-002a
describe("contact emails", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function createContact() {
    const res = await CREATE(
      jsonReq("POST", "/api/contacts", {
        displayName: "Grace Hopper",
        email: { address: "grace@example.com" },
      }),
      ctx(),
    );
    return (await res.json()).id as string;
  }

  it("defaults purposes to ['personal'] when omitted", async () => {
    const res = await CREATE(
      jsonReq("POST", "/api/contacts", {
        displayName: "Default Purpose",
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
});
