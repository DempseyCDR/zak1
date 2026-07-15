import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent, makePerformer } from "./helpers/factories";
import { createBand, patchBand } from "@/server/domain/bands/bandService";
import { bookBand } from "@/server/domain/bands/bookBand";
import { createBooking } from "@/server/domain/bookings/bookingService";
import { groupEventBookingsForDisplay } from "@/server/domain/bands/publicDisplay";

// FR-007, FR-008; US3 scenarios 1/3/4/5; live-identity clarify
describe("groupEventBookingsForDisplay", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("groups band-linked bookings into one block and lists ad-hoc bookings separately", async () => {
    const lead = await makePerformer("Lead");
    const m1 = await makePerformer("M1");
    const adHoc = await makePerformer("Solo Caller");
    const band = await createBand(db, {
      name: "The Band",
      bio: "band bio",
      photoUrl: "https://example.com/band.jpg",
      members: [
        { performerId: lead.id, isLead: true },
        { performerId: m1.id, isLead: false },
      ],
    });
    const evt = await makeEvent();
    await bookBand(db, evt.id, band.id);
    await createBooking(db, evt.id, { performerId: adHoc.id, performerType: "caller", pay: 100 });

    const grouped = await groupEventBookingsForDisplay(db, evt.id);
    expect(grouped.bandBlocks).toHaveLength(1);
    expect(grouped.bandBlocks[0]).toMatchObject({
      name: "The Band",
      bio: "band bio",
      photoUrl: "https://example.com/band.jpg",
    });
    // The band block does not enumerate individual members.
    expect(grouped.bandBlocks[0]).not.toHaveProperty("members");
    expect(grouped.adHoc.map((b) => b.performerName)).toEqual(["Solo Caller"]);
  });

  it("reflects the band's CURRENT name/photo (live read) after an edit", async () => {
    const lead = await makePerformer("Lead");
    const band = await createBand(db, {
      name: "Old Name",
      members: [{ performerId: lead.id, isLead: true }],
    });
    const evt = await makeEvent();
    await bookBand(db, evt.id, band.id);

    await patchBand(db, band.id, { name: "New Name", photoUrl: "https://example.com/new.jpg" });

    const grouped = await groupEventBookingsForDisplay(db, evt.id);
    expect(grouped.bandBlocks[0]?.name).toBe("New Name");
    expect(grouped.bandBlocks[0]?.photoUrl).toBe("https://example.com/new.jpg");
  });

  it("shows two separate blocks for two different bands on one event", async () => {
    const a1 = await makePerformer("A1");
    const b1 = await makePerformer("B1");
    const bandA = await createBand(db, {
      name: "Opener",
      members: [{ performerId: a1.id, isLead: true }],
    });
    const bandB = await createBand(db, {
      name: "Headliner",
      members: [{ performerId: b1.id, isLead: true }],
    });
    const evt = await makeEvent();
    await bookBand(db, evt.id, bandA.id);
    await bookBand(db, evt.id, bandB.id);

    const grouped = await groupEventBookingsForDisplay(db, evt.id);
    expect(grouped.bandBlocks.map((b) => b.name).sort()).toEqual(["Headliner", "Opener"]);
    expect(grouped.adHoc).toHaveLength(0);
  });
});
