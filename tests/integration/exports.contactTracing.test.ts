import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeContactWithEmail, makeEvent, contactRow } from "./helpers/factories";
import { attendance, contacts } from "@/server/db/schema";
import { buildContactTracingRows } from "@/server/domain/exports/contactTracingService";

// FR-006, FR-006a, FR-002a, FR-003, FR-011, SC-005
describe("buildContactTracingRows", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("includes only attendees with an active, contact_tracing-consented email, with the event's date", async () => {
    const evt = await makeEvent({ eventDate: "2026-06-18" });

    const consented = await makeContactWithEmail({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      consentTopics: ["contact_tracing"],
    });
    const dnc = await makeContactWithEmail({
      email: "dnc@example.com",
      consentTopics: ["do_not_contact"],
    });
    const transition = await makeContactWithEmail({
      email: "transition@example.com",
      consentTopics: ["contact_tracing"],
      emailStatus: "transition",
    });
    const [noEmailContact] = await db
      .insert(contacts)
      .values(contactRow("No Email"))
      .returning();

    await db.insert(attendance).values([
      { eventId: evt.id, contactId: consented.contactId },
      { eventId: evt.id, contactId: dnc.contactId },
      { eventId: evt.id, contactId: transition.contactId },
      { eventId: evt.id, contactId: noEmailContact!.id },
      { eventId: evt.id, contactId: null }, // unmatched
    ]);

    const result = await buildContactTracingRows(db, evt.id);
    expect(result.count).toBe(5);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.email).toBe("ada@example.com");
    expect(result.rows[0]?.first_name).toBe("Ada");
    expect(result.rows[0]?.last_name).toBe("Lovelace");
    expect(result.rows[0]?.date).toBe("2026-06-18");
  });
});
