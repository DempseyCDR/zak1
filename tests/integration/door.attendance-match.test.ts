import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent } from "./helpers/factories";
import { POST as CREATE_CONTACT } from "@/app/api/contacts/route";
import { POST as ATTEND } from "@/app/api/events/[id]/attendance/route";

// FR-001, FR-010 (attendance attaches to event, no door record needed)
describe("POST /api/events/:id/attendance (existing contact)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("records attendance against the event and rejects duplicates", async () => {
    const evt = await makeEvent();
    const cRes = await CREATE_CONTACT(
      jsonReq("POST", "/api/contacts", {
        firstName: "Grace Hopper",
        email: { address: "grace@example.com" },
      }),
      ctx(),
    );
    const contactId = (await cRes.json()).id as string;

    const first = await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, { contactId }),
      ctx({ id: evt.id }),
    );
    expect(first.status).toBe(201);

    const dup = await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, { contactId }),
      ctx({ id: evt.id }),
    );
    expect(dup.status).toBe(409);
    expect((await dup.json()).error.code).toBe("ALREADY_CHECKED_IN");
  });
});
