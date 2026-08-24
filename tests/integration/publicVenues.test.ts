import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent } from "./helpers/factories";
import { events, venues } from "@/server/db/schema";
import { patchVenue } from "@/server/domain/venues/venueService";
import { listPublicVenues } from "@/server/domain/public/publicVenues";
import { getPublicEventDetail } from "@/server/domain/public/publicSchedule";

// Feature 052 (P7-R8): the privacy gate — a venue's address/map/directions are public ONLY when it is public
// AND has an address. A non-public venue is name-only everywhere; it never appears on the directions list.
describe("public venues gate", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function seedVenue(v: {
    name: string;
    address: string;
    isPublic: boolean;
    directions?: string | null;
  }): Promise<string> {
    const [row] = await db
      .insert(venues)
      .values({
        name: v.name,
        address: v.address,
        isPublic: v.isPublic,
        directions: v.directions ?? null,
      })
      .returning();
    return row!.id;
  }

  it("listPublicVenues returns only public venues that have an address (with directions)", async () => {
    await seedVenue({
      name: "The Rose Room",
      address: "295 Gregory St",
      isPublic: true,
      directions: "Park next door at the German House.",
    });
    await seedVenue({ name: "A Private Home", address: "999 Secret Ln", isPublic: false });
    await seedVenue({ name: "Placeholder", address: "", isPublic: true }); // no address → excluded

    const list = await listPublicVenues(db);
    expect(list.map((v) => v.name)).toEqual(["The Rose Room"]);
    expect(list[0]!.address).toBe("295 Gregory St");
    expect(list[0]!.directions).toBe("Park next door at the German House.");
    expect(list[0]!.mapUrl).not.toBeNull();
  });

  it("event page: a non-public venue is name-only (no address/map/directions)", async () => {
    const vId = await seedVenue({
      name: "A Private Home",
      address: "999 Secret Ln",
      isPublic: false,
      directions: "Down the private drive.",
    });
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-18" });
    await db.update(events).set({ venueId: vId }).where(eq(events.id, evt.id));

    const detail = await getPublicEventDetail(db, evt.id);
    expect(detail!.venue).not.toBeNull();
    expect(detail!.venue!.name).toBe("A Private Home"); // still names the place
    expect(detail!.venue!.address).toBeNull();
    expect(detail!.venue!.mapUrl).toBeNull();
    expect(detail!.venue!.directions).toBeNull();
  });

  it("event page: a public venue shows the full block incl. directions", async () => {
    const vId = await seedVenue({
      name: "German House",
      address: "315 Gregory St",
      isPublic: true,
      directions: "Street parking or the lot.",
    });
    const evt = await makeEvent({ seriesKey: "tnc", eventDate: "2026-06-25" });
    await db.update(events).set({ venueId: vId }).where(eq(events.id, evt.id));

    const detail = await getPublicEventDetail(db, evt.id);
    expect(detail!.venue!.address).toBe("315 Gregory St");
    expect(detail!.venue!.mapUrl).not.toBeNull();
    expect(detail!.venue!.directions).toBe("Street parking or the lot.");
  });

  it("rejects marking a venue public without an address", async () => {
    const vId = await seedVenue({ name: "No Address Yet", address: "", isPublic: false });
    await expect(patchVenue(db, vId, { isPublic: true })).rejects.toThrow();
  });
});
