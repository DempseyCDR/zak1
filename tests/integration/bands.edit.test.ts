import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent, makePerformer } from "./helpers/factories";
import { bookings, performers } from "@/server/db/schema";
import { createBand } from "@/server/domain/bands/bandService";
import { bookBand } from "@/server/domain/bands/bookBand";
import { GET as GET_ONE, PATCH } from "@/app/api/bands/[id]/route";

// FR-002, FR-009, SC-005
describe("band edit", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("edits name/bio/photo and replaces the roster, reassigning the lead", async () => {
    const p1 = await makePerformer("P1");
    const p2 = await makePerformer("P2");
    const p3 = await makePerformer("P3");
    const band = await createBand(db, {
      name: "Old Name",
      members: [
        { performerId: p1.id, isLead: true },
        { performerId: p2.id, isLead: false },
      ],
    });

    const res = await PATCH(
      jsonReq("PATCH", `/api/bands/${band.id}`, {
        name: "New Name",
        bio: "Updated bio",
        photoUrl: "https://example.com/band.jpg",
        members: [
          { performerId: p2.id, isLead: true }, // lead reassigned to p2
          { performerId: p3.id, isLead: false }, // p1 removed, p3 added
        ],
      }),
      ctx({ id: band.id }),
    );
    expect(res.status).toBe(200);

    const detail = await (
      await GET_ONE(jsonReq("GET", `/api/bands/${band.id}`), ctx({ id: band.id }))
    ).json();
    expect(detail.name).toBe("New Name");
    expect(detail.members).toHaveLength(2);
    expect(detail.members.find((m: { isLead: boolean }) => m.isLead).performerId).toBe(p2.id);
    expect(detail.members.map((m: { performerId: string }) => m.performerId).sort()).toEqual(
      [p2.id, p3.id].sort(),
    );
  });

  it("does not touch a member's own performer bio/photo", async () => {
    const lead = await makePerformer("Lead With Bio");
    await db
      .update(performers)
      .set({ bio: "personal bio", photoUrl: "https://example.com/me.jpg" })
      .where(eq(performers.id, lead.id));
    const band = await createBand(db, {
      name: "Band",
      bio: "band bio",
      photoUrl: "https://example.com/band.jpg",
      members: [{ performerId: lead.id, isLead: true }],
    });

    await PATCH(
      jsonReq("PATCH", `/api/bands/${band.id}`, { bio: "changed band bio" }),
      ctx({ id: band.id }),
    );

    const performer = await db.query.performers.findFirst({ where: eq(performers.id, lead.id) });
    expect(performer?.bio).toBe("personal bio"); // untouched by band edit
    expect(performer?.photoUrl).toBe("https://example.com/me.jpg");
  });

  it("leaves pre-existing band-linked bookings' band_id intact after a roster replace", async () => {
    const p1 = await makePerformer("P1");
    const p2 = await makePerformer("P2");
    const band = await createBand(db, {
      name: "Band",
      members: [
        { performerId: p1.id, isLead: true },
        { performerId: p2.id, isLead: false },
      ],
    });
    const evt = await makeEvent();
    await bookBand(db, evt.id, band.id);

    // Replace the roster entirely.
    await PATCH(
      jsonReq("PATCH", `/api/bands/${band.id}`, {
        members: [{ performerId: p1.id, isLead: true }],
      }),
      ctx({ id: band.id }),
    );

    const linked = await db.select().from(bookings).where(eq(bookings.bandId, band.id));
    expect(linked.length).toBe(2); // both original bookings still linked to the band
  });
});
