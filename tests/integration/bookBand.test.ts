import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent, makePerformer } from "./helpers/factories";
import { bookings } from "@/server/db/schema";
import { createBand } from "@/server/domain/bands/bandService";
import { POST as BOOK_BAND } from "@/app/api/events/[id]/book-band/route";

// FR-003, FR-004, SC-001
describe("POST /api/events/:id/book-band", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("creates one booking per roster member, lead as lead_musician, each linked to the band", async () => {
    const lead = await makePerformer("Lead");
    const m1 = await makePerformer("M1");
    const m2 = await makePerformer("M2");
    const band = await createBand(db, {
      name: "The Quartet",
      members: [
        { performerId: lead.id, isLead: true },
        { performerId: m1.id, isLead: false },
        { performerId: m2.id, isLead: false },
      ],
    });
    const evt = await makeEvent();

    const res = await BOOK_BAND(
      jsonReq("POST", `/api/events/${evt.id}/book-band`, { bandId: band.id }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.createdCount).toBe(3);

    const rows = await db.select().from(bookings).where(eq(bookings.eventId, evt.id));
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.bandId === band.id)).toBe(true);
    expect(rows.find((r) => r.performerId === lead.id)?.performerType).toBe("lead_musician");
    expect(rows.filter((r) => r.performerType === "musician")).toHaveLength(2);
  });
});
