import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReqAs, ctx } from "./helpers/http";
import { makeActor, makeEvent } from "./helpers/factories";
import { series } from "@/server/db/schema";
import { PATCH as EVENT_PATCH } from "@/app/api/events/[id]/route";
import { getPublicEventDetail } from "@/server/domain/public/publicSchedule";
import { assembleOrganizerReport } from "@/server/domain/organizer/reportService";

async function seriesId(key: string): Promise<string> {
  const row = await db.query.series.findFirst({ where: eq(series.key, key) });
  if (!row) throw new Error(`series ${key} not seeded`);
  return row.id;
}

// Feature 018 (B27): advertised price is a public, display-only field settable by Booker or Webmaster.
describe("advertised admission price", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("is settable by both a Booker (own series) and the Webmaster", async () => {
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });

    const booker = await makeActor({
      email: "booker.price@cdrochester.org",
      grants: [{ role: "booker", seriesId: await seriesId("tnc") }],
    });
    const r1 = await EVENT_PATCH(
      jsonReqAs(booker.token, "PATCH", `/api/events/${evt.id}`, { advertisedPriceCents: 1500 }),
      ctx({ id: evt.id }),
    );
    expect(r1.status).toBe(200);

    const web = await makeActor({
      email: "web.price@cdrochester.org",
      grants: [{ role: "webmaster" }],
    });
    const r2 = await EVENT_PATCH(
      jsonReqAs(web.token, "PATCH", `/api/events/${evt.id}`, { advertisedPriceCents: 2000 }),
      ctx({ id: evt.id }),
    );
    expect(r2.status).toBe(200);

    const detail = await getPublicEventDetail(db, evt.id);
    expect(detail?.advertisedPrice).toBe(20); // dollars, display
  });

  it("has no effect on accounting (organizer report unchanged)", async () => {
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    const web = await makeActor({
      email: "web.price2@cdrochester.org",
      grants: [{ role: "webmaster" }],
    });
    // A distinctive amount ($9999.99) that must NOT surface in any accounting figure.
    await EVENT_PATCH(
      jsonReqAs(web.token, "PATCH", `/api/events/${evt.id}`, { advertisedPriceCents: 999_999 }),
      ctx({ id: evt.id }),
    );

    const report = await assembleOrganizerReport(db, "tnc", 2026);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("999999");
    expect(serialized).not.toContain("9999.99");
  });
});
