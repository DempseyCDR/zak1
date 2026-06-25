import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent } from "./helpers/factories";
import { POST as CREATE_CONTACT } from "@/app/api/contacts/route";
import { POST as ATTEND, GET as LIST } from "@/app/api/events/[id]/attendance/route";

// FR-001b
describe("GET /api/events/:id/attendance (attendee list)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("returns checked-in contacts (with names) plus unmatched placeholders", async () => {
    const evt = await makeEvent();
    const cRes = await CREATE_CONTACT(
      jsonReq("POST", "/api/contacts", {
        displayName: "Ada Lovelace",
        email: { address: "ada@example.com" },
      }),
      ctx(),
    );
    const contactId = (await cRes.json()).id as string;

    await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, { contactId }),
      ctx({ id: evt.id }),
    );
    await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, { unmatched: true }),
      ctx({ id: evt.id }),
    );

    const res = await LIST(jsonReq("GET", `/api/events/${evt.id}/attendance`), ctx({ id: evt.id }));
    const body = await res.json();
    expect(body.count).toBe(2);

    const matched = body.attendees.find((a: { contactId: string | null }) => a.contactId === contactId);
    expect(matched.displayName).toBe("Ada Lovelace");

    const unmatched = body.attendees.find((a: { contactId: string | null }) => a.contactId === null);
    expect(unmatched.displayName).toBeNull();
  });

  it("returns an empty list for an event with no attendance", async () => {
    const evt = await makeEvent();
    const res = await LIST(jsonReq("GET", `/api/events/${evt.id}/attendance`), ctx({ id: evt.id }));
    const body = await res.json();
    expect(body.count).toBe(0);
    expect(body.attendees).toEqual([]);
  });
});
