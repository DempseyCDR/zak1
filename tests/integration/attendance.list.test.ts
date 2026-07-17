import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent } from "./helpers/factories";
import { createContact } from "@/server/domain/contacts/contactService";
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
        firstName: "Ada Lovelace",
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

    const matched = body.attendees.find(
      (a: { contactId: string | null }) => a.contactId === contactId,
    );
    expect(matched.displayName).toBe("Ada Lovelace");

    const unmatched = body.attendees.find(
      (a: { contactId: string | null }) => a.contactId === null,
    );
    expect(unmatched.displayName).toBeNull();
  });

  it("returns an empty list for an event with no attendance", async () => {
    const evt = await makeEvent();
    const res = await LIST(jsonReq("GET", `/api/events/${evt.id}/attendance`), ctx({ id: evt.id }));
    const body = await res.json();
    expect(body.count).toBe(0);
    expect(body.attendees).toEqual([]);
  });

  // Feature 017 (B33): structured names + a sortable roster.
  it("returns structured first/last names and sorts by first or last", async () => {
    const evt = await makeEvent();
    const ada = await createContact(db, { firstName: "Ada", lastName: "Lovelace" });
    const grace = await createContact(db, { firstName: "Grace", lastName: "Hopper" });
    const bob = await createContact(db, { firstName: "Bob", lastName: "Frost" });
    for (const c of [ada, grace, bob]) {
      await ATTEND(
        jsonReq("POST", `/api/events/${evt.id}/attendance`, { contactId: c.id }),
        ctx({ id: evt.id }),
      );
    }

    const byLast = await (
      await LIST(jsonReq("GET", `/api/events/${evt.id}/attendance?sort=last`), ctx({ id: evt.id }))
    ).json();
    expect(byLast.attendees.map((a: { lastName: string | null }) => a.lastName)).toEqual([
      "Frost",
      "Hopper",
      "Lovelace",
    ]);
    // Structured names are exposed, not only the display name.
    expect(byLast.attendees[0]).toMatchObject({ firstName: "Bob", lastName: "Frost" });

    const byFirst = await (
      await LIST(jsonReq("GET", `/api/events/${evt.id}/attendance?sort=first`), ctx({ id: evt.id }))
    ).json();
    expect(byFirst.attendees.map((a: { firstName: string | null }) => a.firstName)).toEqual([
      "Ada",
      "Bob",
      "Grace",
    ]);
  });

  it("sorts unmatched placeholders last", async () => {
    const evt = await makeEvent();
    const zoe = await createContact(db, { firstName: "Zoe", lastName: "Zephyr" });
    await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, { unmatched: true }),
      ctx({ id: evt.id }),
    );
    await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, { contactId: zoe.id }),
      ctx({ id: evt.id }),
    );

    const byLast = await (
      await LIST(jsonReq("GET", `/api/events/${evt.id}/attendance?sort=last`), ctx({ id: evt.id }))
    ).json();
    // Zoe (matched) first, unmatched placeholder (null names) last.
    expect(byLast.attendees[0].contactId).toBe(zoe.id);
    expect(byLast.attendees[1].contactId).toBeNull();
  });
});
