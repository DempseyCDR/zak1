import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent } from "./helpers/factories";
import { contacts } from "@/server/db/schema";
import { POST as ATTEND } from "@/app/api/events/[id]/attendance/route";

// FR-003
describe("POST /api/events/:id/attendance (new contact)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("creates a contact flagged needs_review and records attendance", async () => {
    const evt = await makeEvent();
    const res = await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, {
        newContact: { firstName: "Walk In", email: "walkin@example.com" },
      }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(201);
    const att = await res.json();

    const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, att.contactId) });
    expect(contact?.needsReview).toBe(true);
    expect(contact?.source).toBe("door");
  });

  it("accepts a phone number in place of an email", async () => {
    const evt = await makeEvent();
    const res = await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, {
        newContact: { firstName: "Phone Walk In", phone: "585-555-0101" },
      }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(201);
    const att = await res.json();

    const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, att.contactId) });
    expect(contact?.phone).toBe("585-555-0101");
  });

  it("accepts neither email nor phone (declined) without a 422", async () => {
    const evt = await makeEvent();
    const res = await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, {
        newContact: { firstName: "Declined Contact Info" },
      }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(201);
  });

  // Feature 017 (B34): first + last name and an editable display name at the door.
  it("persists first and last name, deriving display_name = 'first last'", async () => {
    const evt = await makeEvent();
    const res = await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, {
        newContact: { firstName: "Jane", lastName: "Smith" },
      }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(201);
    const att = await res.json();

    const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, att.contactId) });
    expect(contact?.firstName).toBe("Jane");
    expect(contact?.lastName).toBe("Smith");
    expect(contact?.displayNameOverride).toBeNull();
    expect(contact?.displayName).toBe("Jane Smith");
  });

  it("persists an edited display name as the override, keeping first/last separate", async () => {
    const evt = await makeEvent();
    const res = await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, {
        newContact: { firstName: "Jane", lastName: "Smith", displayNameOverride: "DJ Jane" },
      }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(201);
    const att = await res.json();

    const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, att.contactId) });
    expect(contact?.firstName).toBe("Jane");
    expect(contact?.lastName).toBe("Smith");
    expect(contact?.displayNameOverride).toBe("DJ Jane");
    expect(contact?.displayName).toBe("DJ Jane");
  });
});
