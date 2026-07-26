import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { createVenue, patchVenue, getVenue } from "@/server/domain/venues/venueService";

// Feature 020 US5 (FR-024): short name defaults from initials at create, editable, non-unique.
describe("venue short name", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("defaults the short name from the name's initials when omitted", async () => {
    const v = await createVenue(db, { name: "German House", address: "1 Main St" });
    expect(v.shortName).toBe("GH");
  });

  it("keeps an explicit short name at create", async () => {
    const v = await createVenue(db, {
      name: "German House",
      address: "1 Main St",
      shortName: "GHouse",
    });
    expect(v.shortName).toBe("GHouse");
  });

  it("edits the short name via patch", async () => {
    const v = await createVenue(db, { name: "The Rose Room", address: "2 Elm St" });
    expect(v.shortName).toBe("TRR");
    await patchVenue(db, v.id, { shortName: "Rose" });
    expect((await getVenue(db, v.id)).shortName).toBe("Rose");
  });
});
