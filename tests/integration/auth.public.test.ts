import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { db } from "@/server/db/client";
import { makeEvent } from "./helpers/factories";
import { getPublicSchedule } from "@/server/domain/public/publicSchedule";

/**
 * SC-003 / FR-003: the public site must not regress.
 *
 * Feature 015 makes everything default-deny; this is the guard that the browse-only public site
 * (feature 007) stayed open. The public pages are React Server Components reading `domain/public/`
 * directly — they never call the API — which is why locking down `/api/*` does not touch them.
 */
describe("public surface stays open (FR-003, SC-003)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("serves the public schedule with no session whatsoever", async () => {
    await makeEvent({ eventDate: "2099-01-01" });
    const schedule = await getPublicSchedule(db);
    expect(schedule.length).toBeGreaterThan(0);
  });

  it("the public read model requires no staff identity to construct", async () => {
    // If this ever needs auth, the public site has been broken.
    await expect(getPublicSchedule(db)).resolves.toBeDefined();
  });
});
