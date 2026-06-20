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
        newContact: { displayName: "Walk In", email: "walkin@example.com" },
      }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(201);
    const att = await res.json();

    const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, att.contactId) });
    expect(contact?.needsReview).toBe(true);
    expect(contact?.source).toBe("door");
  });
});
