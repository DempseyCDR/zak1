import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent, makePerformer } from "./helpers/factories";
import { createBand } from "@/server/domain/bands/bandService";
import { bookBand } from "@/server/domain/bands/bookBand";
import { createBooking } from "@/server/domain/bookings/bookingService";
import { getPublicEventDetail } from "@/server/domain/public/publicSchedule";
import { bookings, events, venues } from "@/server/db/schema";

// Feature 049 (P7-R5): the enriched event page needs two things the detail projection did not carry —
// the stable series key (for the color + hero) and each confirmed band's members (for the lineup). This
// proves getPublicEventDetail now carries both, and that the confirmed-only rule (018) still holds.
describe("getPublicEventDetail — enrichment projection", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("carries seriesKey and each confirmed band's members, and excludes non-confirmed bookings", async () => {
    const lead = await makePerformer("Ada Lead");
    const member = await makePerformer("Ben Member");
    const caller = await makePerformer("Cora Caller");

    const band = await createBand(db, {
      name: "The Testers",
      bio: "band bio",
      photoUrl: "https://example.com/band.jpg",
      members: [
        { performerId: lead.id, isLead: true },
        { performerId: member.id, isLead: false },
      ],
    });

    const [v] = await db
      .insert(venues)
      .values({ name: "The Rose Room", shortName: "Rose", address: "1 Rose St" })
      .returning();
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    await db.update(events).set({ venueId: v!.id }).where(eq(events.id, evt.id));

    await bookBand(db, evt.id, band.id);
    // An ad-hoc caller left NON-confirmed (createBooking defaults to "proposed") must not appear publicly.
    await createBooking(db, evt.id, { performerId: caller.id, performerType: "caller", pay: 100 });

    // Confirm only the band's bookings; the caller stays proposed.
    await db
      .update(bookings)
      .set({ status: "confirmed" })
      .where(and(eq(bookings.eventId, evt.id), eq(bookings.bandId, band.id)));

    const detail = await getPublicEventDetail(db, evt.id);
    expect(detail).not.toBeNull();
    expect(detail!.seriesKey).toBe("tnc");

    expect(detail!.bandBlocks).toHaveLength(1);
    const block = detail!.bandBlocks[0]!;
    expect(block.name).toBe("The Testers");
    const memberNames = block.members.map((m) => m.name).sort();
    expect(memberNames).toEqual(["Ada Lead", "Ben Member"]);
    expect(block.members.find((m) => m.name === "Ada Lead")!.isLead).toBe(true);
    expect(block.members.find((m) => m.name === "Ben Member")!.isLead).toBe(false);

    // Confirmed-only (018): the proposed caller is not advertised.
    const performerNames = detail!.performers.flatMap((p) =>
      "name" in p && p.name ? [p.name] : [],
    );
    expect(performerNames).not.toContain("Cora Caller");
  });
});
