import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts, venues } from "@/server/db/schema";
import { createVenue, patchVenue } from "@/server/domain/venues/venueService";
import { createContact } from "@/server/domain/contacts/contactService";

// Feature 018 (B22): a venue can name/clear an optional landlord contact; the link degrades gracefully.
describe("venue landlord contact", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("sets and clears the landlord", async () => {
    const venue = await createVenue(db, { name: "Hall", address: "1 Main St" });
    const landlord = await createContact(db, { firstName: "Larry", lastName: "Landlord" });

    const set = await patchVenue(db, venue.id, { landlordContactId: landlord.id });
    expect(set.landlordContactId).toBe(landlord.id);

    const cleared = await patchVenue(db, venue.id, { landlordContactId: null });
    expect(cleared.landlordContactId).toBeNull();
  });

  it("nulls the link when the landlord contact is deleted (ON DELETE SET NULL)", async () => {
    const venue = await createVenue(db, { name: "Hall", address: "1 Main St" });
    const landlord = await createContact(db, { firstName: "Larry", lastName: "Landlord" });
    await patchVenue(db, venue.id, { landlordContactId: landlord.id });

    await db.delete(contacts).where(eq(contacts.id, landlord.id));

    const row = await db.query.venues.findFirst({ where: eq(venues.id, venue.id) });
    expect(row?.landlordContactId).toBeNull();
  });
});
