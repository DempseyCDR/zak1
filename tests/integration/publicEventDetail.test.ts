import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent, makePerformer } from "./helpers/factories";
import { performers } from "@/server/db/schema";
import { createBooking } from "@/server/domain/bookings/bookingService";
import { createBand } from "@/server/domain/bands/bandService";
import { bookBand } from "@/server/domain/bands/bookBand";
import { getPublicEventDetail } from "@/server/domain/public/publicSchedule";

// FR-002, FR-003, SC-005 + public-safety
describe("getPublicEventDetail", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("applies public-display rules, hides Sound Tech, groups bands, and leaks no private data", async () => {
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });

    const caller = await makePerformer("Cal Caller");
    await db.update(performers).set({ bio: "Calls contras.", photoUrl: "https://ex.com/cal.jpg" }).where(eq(performers.id, caller.id));
    const soundTech = await makePerformer("Sam Sound");
    const openBand = await makePerformer("Ollie Openband");
    const instructor = await makePerformer("Ivy Instructor");
    const adHocMusician = await makePerformer("Manny Musician");

    await createBooking(db, evt.id, { performerId: caller.id, performerType: "caller", pay: 150 });
    await createBooking(db, evt.id, { performerId: soundTech.id, performerType: "sound_tech", pay: 100 });
    await createBooking(db, evt.id, { performerId: openBand.id, performerType: "open_band_musician" });
    await createBooking(db, evt.id, { performerId: instructor.id, performerType: "instructor", note: "Teaches the beginner lesson" });
    await createBooking(db, evt.id, { performerId: adHocMusician.id, performerType: "musician", pay: 60 });

    // A booked band (renders as a block).
    const lead = await makePerformer("Bandy Lead");
    const bandMember = await makePerformer("Bea Member");
    const band = await createBand(db, {
      name: "The Rovers",
      bio: "A touring band.",
      photoUrl: "https://ex.com/rovers.jpg",
      members: [
        { performerId: lead.id, isLead: true },
        { performerId: bandMember.id, isLead: false },
      ],
    });
    await bookBand(db, evt.id, band.id);

    const detail = await getPublicEventDetail(db, evt.id);
    expect(detail).not.toBeNull();

    // Band block present, one only, with band identity (not members).
    expect(detail!.bandBlocks).toHaveLength(1);
    expect(detail!.bandBlocks[0]).toMatchObject({ name: "The Rovers", bio: "A touring band.", photoUrl: "https://ex.com/rovers.jpg" });

    // Individual (non-band) performers, by display rule.
    const kinds = detail!.performers.map((p) => p.kind);
    expect(kinds).toContain("full_bio"); // caller + ad-hoc musician
    expect(kinds).toContain("open_band");
    expect(kinds).toContain("name_note"); // instructor

    // Sound Tech is absent entirely.
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("Sam Sound");

    const callerEntry = detail!.performers.find((p) => p.kind === "full_bio" && "name" in p && p.name === "Cal Caller");
    expect(callerEntry).toMatchObject({ name: "Cal Caller", bio: "Calls contras.", photoUrl: "https://ex.com/cal.jpg" });

    const instructorEntry = detail!.performers.find((p) => p.kind === "name_note");
    expect(instructorEntry).toMatchObject({ name: "Ivy Instructor", note: "Teaches the beginner lesson" });

    // Public-safety: no pay amounts / cents, no contact, no attendance anywhere.
    expect(serialized).not.toMatch(/payCents|"pay"|contact|attendance|checkNumber/i);
    expect(serialized).not.toContain("15000");
    expect(serialized).not.toContain("6000");
  });

  it("returns null for an unknown event", async () => {
    expect(await getPublicEventDetail(db, "00000000-0000-0000-0000-000000000009")).toBeNull();
  });
});
