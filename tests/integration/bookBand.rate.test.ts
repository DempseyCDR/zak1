import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent, makePerformer } from "./helpers/factories";
import { bookings } from "@/server/db/schema";
import { createBand } from "@/server/domain/bands/bandService";
import { createRateParameter } from "@/server/domain/parameters/seriesParameterService";
import { POST as BOOK_BAND } from "@/app/api/events/[id]/book-band/route";

// FR-003a, FR-006; server-side regression for FR-012/FR-013 (musician rate delivered by feature 009)
describe("book-band per-member pay default", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function bookDuo(bandName: string, memberPay?: { performerId: string; amount: number }[]) {
    const lead = await makePerformer(`${bandName} Lead`);
    const m1 = await makePerformer(`${bandName} M1`);
    const band = await createBand(db, {
      name: bandName,
      members: [
        { performerId: lead.id, isLead: true },
        { performerId: m1.id, isLead: false },
      ],
    });
    const evt = await makeEvent({ eventDate: "2026-06-18" }); // series "tnc"
    const res = await BOOK_BAND(
      jsonReq("POST", `/api/events/${evt.id}/book-band`, { bandId: band.id, ...(memberPay ? { memberPay } : {}) }),
      ctx({ id: evt.id }),
    );
    const rows = await db.select().from(bookings).where(eq(bookings.eventId, evt.id));
    return { lead, m1, rows, status: res.status };
  }

  it("defaults every member to the series musician rate when one is set", async () => {
    await createRateParameter(db, { seriesKey: "tnc", kind: "musician", amount: 75, effectiveDate: "2026-01-01" });
    const { rows } = await bookDuo("Rate Band");
    expect(rows.every((r) => r.payCents === 7500)).toBe(true); // both lead and musician default to the musician rate
  });

  it("defaults to 0 when no musician rate is set", async () => {
    const { rows } = await bookDuo("No Rate Band");
    expect(rows.every((r) => r.payCents === 0)).toBe(true);
  });

  it("honors an explicit per-member override", async () => {
    await createRateParameter(db, { seriesKey: "tnc", kind: "musician", amount: 75, effectiveDate: "2026-01-01" });
    const lead = await makePerformer("Ovr Lead");
    const m1 = await makePerformer("Ovr M1");
    const band = await createBand(db, {
      name: "Override Band",
      members: [
        { performerId: lead.id, isLead: true },
        { performerId: m1.id, isLead: false },
      ],
    });
    const evt = await makeEvent({ eventDate: "2026-06-18" });
    await BOOK_BAND(
      jsonReq("POST", `/api/events/${evt.id}/book-band`, {
        bandId: band.id,
        memberPay: [{ performerId: m1.id, amount: 120 }],
      }),
      ctx({ id: evt.id }),
    );
    const rows = await db.select().from(bookings).where(eq(bookings.eventId, evt.id));
    expect(rows.find((r) => r.performerId === m1.id)?.payCents).toBe(12000); // override
    expect(rows.find((r) => r.performerId === lead.id)?.payCents).toBe(7500); // still the rate default
  });
});
