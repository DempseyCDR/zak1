import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent, makePerformer } from "./helpers/factories";
import { bookings } from "@/server/db/schema";
import { createBand, patchBand } from "@/server/domain/bands/bandService";
import { bookBand } from "@/server/domain/bands/bookBand";

// SC-004 — editing a band's roster does not change an already-booked event's bookings.
describe("book-band historical integrity", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("a roster edit after booking does not change that event's created bookings", async () => {
    const lead = await makePerformer("Lead");
    const m1 = await makePerformer("M1");
    const m2 = await makePerformer("M2");
    const band = await createBand(db, {
      name: "Band",
      members: [
        { performerId: lead.id, isLead: true },
        { performerId: m1.id, isLead: false },
      ],
    });
    const evt = await makeEvent();
    await bookBand(db, evt.id, band.id);

    const before = await db.select().from(bookings).where(eq(bookings.eventId, evt.id));
    expect(before).toHaveLength(2);

    // Change the roster: drop m1, add m2.
    await patchBand(db, band.id, {
      members: [
        { performerId: lead.id, isLead: true },
        { performerId: m2.id, isLead: false },
      ],
    });

    const after = await db.select().from(bookings).where(eq(bookings.eventId, evt.id));
    expect(after).toHaveLength(2);
    expect(after.map((r) => r.performerId).sort()).toEqual([lead.id, m1.id].sort()); // still the originally-booked members
  });
});
