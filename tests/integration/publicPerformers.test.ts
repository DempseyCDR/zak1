import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { bandMembers, bands, performers } from "@/server/db/schema";
import { listPublicBands, listPublicCallers } from "@/server/domain/public/publicPerformers";

// Feature 053 (P7-R9): the privacy + visibility gate. A band is exposed only when public AND not archived; a
// caller only when public AND designated a caller. The style filter narrows both. No contact field is ever
// present on a projected result.
describe("public performer roster gate", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function seedPerformer(v: {
    displayName: string;
    isPublic?: boolean;
    isCaller?: boolean;
    styles?: string[];
    links?: { type: string; url: string }[];
  }): Promise<string> {
    const [row] = await db
      .insert(performers)
      .values({
        displayName: v.displayName,
        isPublic: v.isPublic ?? false,
        isCaller: v.isCaller ?? false,
        styles: v.styles ?? [],
        links: (v.links ?? []) as never,
      })
      .returning();
    return row!.id;
  }

  async function seedBand(v: {
    name: string;
    isPublic?: boolean;
    archived?: boolean;
    styles?: string[];
    links?: { type: string; url: string }[];
  }): Promise<string> {
    const [row] = await db
      .insert(bands)
      .values({
        name: v.name,
        isPublic: v.isPublic ?? false,
        archivedAt: v.archived ? new Date() : null,
        styles: v.styles ?? [],
        links: (v.links ?? []) as never,
      })
      .returning();
    return row!.id;
  }

  it("listPublicBands returns only public, non-archived bands (with member instruments)", async () => {
    const publicBand = await seedBand({
      name: "The Free Raisins",
      isPublic: true,
      styles: ["contra"],
      links: [{ type: "website", url: "https://freeraisins.example" }],
    });
    const memberId = await seedPerformer({ displayName: "Fiddler Fran" });
    await db
      .insert(bandMembers)
      .values({ bandId: publicBand, performerId: memberId, isLead: true, instrument: "fiddle" });

    await seedBand({ name: "Private Band", isPublic: false, styles: ["contra"] });
    await seedBand({ name: "Archived Band", isPublic: true, archived: true, styles: ["contra"] });

    const list = await listPublicBands(db);
    expect(list.map((b) => b.name)).toEqual(["The Free Raisins"]);
    expect(list[0]!.styles).toEqual(["contra"]);
    expect(list[0]!.links[0]!.url).toBe("https://freeraisins.example");
    expect(list[0]!.members).toEqual([
      { name: "Fiddler Fran", isLead: true, instrument: "fiddle" },
    ]);
    // No contact field leaks onto the projection.
    expect(Object.keys(list[0]!)).not.toContain("contactId");
  });

  it("listPublicCallers returns only public callers (never non-callers or private performers)", async () => {
    await seedPerformer({
      displayName: "Cathy Caller",
      isPublic: true,
      isCaller: true,
      styles: ["english"],
    });
    await seedPerformer({ displayName: "Private Caller", isPublic: false, isCaller: true });
    await seedPerformer({ displayName: "Musician Only", isPublic: true, isCaller: false });

    const callers = await listPublicCallers(db);
    expect(callers.map((c) => c.name)).toEqual(["Cathy Caller"]);
    expect(callers[0]!.styles).toEqual(["english"]);
    expect(Object.keys(callers[0]!)).not.toContain("contactId");
  });

  it("style filter narrows bands and callers", async () => {
    await seedBand({ name: "Contra Band", isPublic: true, styles: ["contra"] });
    await seedBand({ name: "English Band", isPublic: true, styles: ["english"] });
    await seedPerformer({
      displayName: "Contra Caller",
      isPublic: true,
      isCaller: true,
      styles: ["contra"],
    });
    await seedPerformer({
      displayName: "English Caller",
      isPublic: true,
      isCaller: true,
      styles: ["english"],
    });

    expect((await listPublicBands(db, "contra")).map((b) => b.name)).toEqual(["Contra Band"]);
    expect((await listPublicCallers(db, "english")).map((c) => c.name)).toEqual(["English Caller"]);
    // Unknown/absent style → no filtering.
    expect((await listPublicBands(db, "salsa")).length).toBe(2);
    expect((await listPublicBands(db)).length).toBe(2);
  });
});
