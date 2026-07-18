import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReqAs, ctx } from "./helpers/http";
import { makeActor, makeEvent } from "./helpers/factories";
import { series } from "@/server/db/schema";
import { PATCH as EVENT_PATCH } from "@/app/api/events/[id]/route";

async function seriesId(key: string): Promise<string> {
  const row = await db.query.series.findFirst({ where: eq(series.key, key) });
  if (!row) throw new Error(`series ${key} not seeded`);
  return row.id;
}

// Feature 018 (B25): reschedule = change eventDate (Booker, event.write). The Webmaster holds
// event.public.write but NOT event.write, so a Webmaster submitting eventDate is refused by assertFields.
describe("event reschedule (field-level auth)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("lets a Booker (own series) change the date", async () => {
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    const { token } = await makeActor({
      email: "booker.tnc@cdrochester.org",
      grants: [{ role: "booker", seriesId: await seriesId("tnc") }],
    });
    const res = await EVENT_PATCH(
      jsonReqAs(token, "PATCH", `/api/events/${evt.id}`, { eventDate: "2026-06-25" }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).eventDate).toBe("2026-06-25");
  });

  it("refuses a Webmaster submitting the date (FIELD_NOT_PERMITTED)", async () => {
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    const { token } = await makeActor({
      email: "web@cdrochester.org",
      grants: [{ role: "webmaster" }],
    });
    const res = await EVENT_PATCH(
      jsonReqAs(token, "PATCH", `/api/events/${evt.id}`, { eventDate: "2026-07-01" }),
      ctx({ id: evt.id }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FIELD_NOT_PERMITTED");
  });
});
