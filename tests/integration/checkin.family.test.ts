import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent } from "./helpers/factories";
import { createContact } from "@/server/domain/contacts/contactService";
import { attendance, events } from "@/server/db/schema";
import { POST as ATTEND } from "@/app/api/events/[id]/attendance/route";

// Feature 017 (B35): family check-in — one parent contact + a children count (all series). Children
// count as PAYING: they raise attendance and, through the unchanged formula, paying dancers.
describe("POST /api/events/:id/attendance (family / children count)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("stores children_count on the parent row and adds 1 + N to attendance_count", async () => {
    const evt = await makeEvent();
    const parent = await createContact(db, { firstName: "Parent", lastName: "One" });

    const res = await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, {
        contactId: parent.id,
        childrenCount: 3,
      }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(201);
    const att = await res.json();

    const row = await db.query.attendance.findFirst({ where: eq(attendance.id, att.id) });
    expect(row?.childrenCount).toBe(3);

    const ev = await db.query.events.findFirst({ where: eq(events.id, evt.id) });
    expect(ev?.attendanceCount).toBe(4); // parent + 3 children
  });

  it("treats an omitted children count as zero (ordinary single check-in)", async () => {
    const evt = await makeEvent();
    const parent = await createContact(db, { firstName: "Solo", lastName: "Two" });

    await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, { contactId: parent.id }),
      ctx({ id: evt.id }),
    );
    const ev = await db.query.events.findFirst({ where: eq(events.id, evt.id) });
    expect(ev?.attendanceCount).toBe(1);
  });

  it("rejects a children count on the unmatched variant", async () => {
    const evt = await makeEvent();
    const res = await ATTEND(
      jsonReq("POST", `/api/events/${evt.id}/attendance`, { unmatched: true, childrenCount: 2 }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(422);
  });
});
