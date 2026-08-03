import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent } from "./helpers/factories";
import { contacts } from "@/server/db/schema";
import { createContact, patchContact } from "@/server/domain/contacts/contactService";
import { createPerformer } from "@/server/domain/performers/performerService";
import { recordAttendance } from "@/server/domain/attendance/attendanceService";

// Feature 032 (P5-R6) US1: every path that writes contacts.phone normalizes it to the canonical form.
async function phoneOf(contactId: string): Promise<string | null> {
  const row = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
  return row?.phone ?? null;
}

describe("contact phone normalization at every write path (032 US1)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("createContact stores the canonical value for a messy phone", async () => {
    const c = await createContact(db, { firstName: "Ann", phone: "(585) 555-1234" });
    expect(await phoneOf(c.id)).toBe("+15855551234");
  });

  it("createContact stores an unparseable phone raw (no data loss)", async () => {
    const c = await createContact(db, { firstName: "Ray", phone: "585-1234 x89" });
    expect(await phoneOf(c.id)).toBe("585-1234 x89");
  });

  it("patchContact re-normalizes the phone", async () => {
    const c = await createContact(db, { firstName: "Pat" });
    await patchContact(db, c.id, { phone: "585.555.9999" });
    expect(await phoneOf(c.id)).toBe("+15855559999");
  });

  it("createPerformer normalizes the seeded contact's phone", async () => {
    const p = await createPerformer(db, { firstName: "Perf", phone: "1-585-555-1234" });
    expect(p.contactId).not.toBeNull();
    expect(await phoneOf(p.contactId!)).toBe("+15855551234");
  });

  it("the check-in new-contact path normalizes the phone", async () => {
    const evt = await makeEvent({ seriesKey: "tnc" });
    const att = await recordAttendance(db, evt.id, {
      newContact: { firstName: "Dora", phone: "5855550000" },
    });
    expect(att.contactId).not.toBeNull();
    expect(await phoneOf(att.contactId!)).toBe("+15855550000");
  });
});
