import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent } from "./helpers/factories";
import { venues } from "@/server/db/schema";
import { getPublicSchedule } from "@/server/domain/public/publicSchedule";

// Feature 048 (P7-R4): the card needs two fields the public projection did not carry before — the stable
// series key (drives the card's color) and the venue SHORT name (the card's venue field, nullable). This
// proves the shared projection now carries both, with correct values and the null degradation.
describe("getPublicSchedule — card projection fields", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  const cutoff = "2026-06-01";

  it("carries the series key and the venue short name for each event", async () => {
    const [v] = await db
      .insert(venues)
      .values({
        name: "German House Ballroom",
        shortName: "German House",
        address: "315 Gregory St",
      })
      .returning();
    const ev = await makeEvent({ seriesKey: "ecd", eventDate: "2026-06-18", venueId: v!.id });

    const schedule = await getPublicSchedule(db, cutoff);
    const item = schedule.find((s) => s.eventId === ev.id)!;
    expect(item.seriesKey).toBe("ecd");
    expect(item.venueShortName).toBe("German House");
    expect(item.venueName).toBe("German House Ballroom"); // full name still present for the fallback
  });

  it("returns a null venueShortName when the venue has no short name (card falls back to the full name)", async () => {
    const [v] = await db
      .insert(venues)
      .values({ name: "The Rose Room", address: "1 Rose St" }) // no shortName
      .returning();
    const ev = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-19", venueId: v!.id });

    const schedule = await getPublicSchedule(db, cutoff);
    const item = schedule.find((s) => s.eventId === ev.id)!;
    expect(item.seriesKey).toBe("tnc");
    expect(item.venueShortName).toBeNull();
    expect(item.venueName).toBe("The Rose Room");
  });
});
