import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { auditEvents } from "@/server/db/schema";
import {
  createCampaign,
  deleteCampaign,
  getShownCampaign,
  listCampaigns,
  updateCampaign,
} from "@/server/domain/campaigns/campaignService";
import type { CampaignInput } from "@/server/validation/campaign";

// Feature 057 (P7-R14, real Postgres): CRUD + the shown-selection + audit. Single-campaign and queue behavior
// (two active + handoff) both live here; the pure ordering is unit-tested in campaignSelect.test.ts.

const TODAY = new Date().toISOString().slice(0, 10);
function plusDays(n: number): string {
  return new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
}

function input(over: Partial<CampaignInput> = {}): CampaignInput {
  return {
    heading: "Golden Weekend",
    blurb: "Three days of dancing",
    image: null,
    cta: { label: "Learn more", url: "/golden-weekend" },
    startDate: plusDays(-1),
    endDate: plusDays(7),
    ...over,
  };
}

describe("campaignService", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("creates and returns the display projection (no internal columns) for an active campaign", async () => {
    await createCampaign(
      db,
      input({ image: { url: "https://ex.org/a.jpg", alt: "Dancers" } }),
      null,
    );
    const shown = await getShownCampaign(db);
    expect(shown).not.toBeNull();
    expect(shown).toEqual({
      id: expect.any(String),
      heading: "Golden Weekend",
      blurb: "Three days of dancing",
      image: { url: "https://ex.org/a.jpg", alt: "Dancers" },
      cta: { label: "Learn more", url: "/golden-weekend" },
    });
    expect(Object.keys(shown!).sort()).toEqual(["blurb", "cta", "heading", "id", "image"]);
  });

  it("projects image=null when no image is set", async () => {
    await createCampaign(db, input(), null);
    expect((await getShownCampaign(db))!.image).toBeNull();
  });

  it("does not show a future or past campaign", async () => {
    await createCampaign(db, input({ startDate: plusDays(3), endDate: plusDays(10) }), null); // future
    expect(await getShownCampaign(db)).toBeNull();
    await resetDb();
    await createCampaign(db, input({ startDate: plusDays(-10), endDate: plusDays(-3) }), null); // past
    expect(await getShownCampaign(db)).toBeNull();
  });

  it("edits a campaign", async () => {
    const id = await createCampaign(db, input(), null);
    const ok = await updateCampaign(db, id, input({ heading: "Jane Austen Ball" }), null);
    expect(ok).toBe(true);
    expect((await getShownCampaign(db))!.heading).toBe("Jane Austen Ball");
  });

  it("update of an unknown id returns false", async () => {
    const ok = await updateCampaign(db, "00000000-0000-0000-0000-000000000000", input(), null);
    expect(ok).toBe(false);
  });

  it("removes a campaign (delete)", async () => {
    const id = await createCampaign(db, input(), null);
    await deleteCampaign(db, id, null);
    expect(await getShownCampaign(db)).toBeNull();
  });

  it("shows the sooner-expiring of two active campaigns, and hands off on delete", async () => {
    const longId = await createCampaign(
      db,
      input({ heading: "Long", startDate: plusDays(-1), endDate: plusDays(20) }),
      null,
    );
    await createCampaign(
      db,
      input({ heading: "Short", startDate: plusDays(-1), endDate: plusDays(3) }),
      null,
    );
    // Short expires first → it is shown.
    expect((await getShownCampaign(db))!.heading).toBe("Short");
    // Delete the shown (Short) → Long shows (the handoff).
    const shownId = (await listCampaigns(db)).find((c) => c.shown)!.id;
    await deleteCampaign(db, shownId, null);
    expect((await getShownCampaign(db))!.heading).toBe("Long");
    expect(longId).toBeTruthy();
  });

  it("listCampaigns marks per-row status and exactly one shown", async () => {
    await createCampaign(
      db,
      input({ heading: "Upcoming", startDate: plusDays(3), endDate: plusDays(10) }),
      null,
    );
    await createCampaign(
      db,
      input({ heading: "Active", startDate: plusDays(-1), endDate: plusDays(5) }),
      null,
    );
    await createCampaign(
      db,
      input({ heading: "Ended", startDate: plusDays(-10), endDate: plusDays(-2) }),
      null,
    );
    const list = await listCampaigns(db);
    const byHeading = Object.fromEntries(list.map((c) => [c.heading, c]));
    expect(byHeading.Upcoming!.status).toBe("upcoming");
    expect(byHeading.Active!.status).toBe("active");
    expect(byHeading.Ended!.status).toBe("ended");
    expect(list.filter((c) => c.shown)).toHaveLength(1);
    expect(byHeading.Active!.shown).toBe(true);
  });

  it("writes an audit_events row per create, update, and delete", async () => {
    const id = await createCampaign(db, input(), null);
    await updateCampaign(db, id, input({ heading: "Edited" }), null);
    await deleteCampaign(db, id, null);
    for (const kind of ["campaign.created", "campaign.updated", "campaign.deleted"] as const) {
      const rows = await db.select().from(auditEvents).where(eq(auditEvents.kind, kind));
      expect(rows, kind).toHaveLength(1);
    }
    expect(TODAY).toBeTruthy();
  });
});
