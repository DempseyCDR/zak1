import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { isNotNull, isNull } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts, mergeAudit } from "@/server/db/schema";
import { contactRow } from "./helpers/factories";
import { GET as SUGGESTIONS } from "@/app/api/dedup/suggestions/route";
import { jsonReq, ctx } from "./helpers/http";

// FR-011: generating suggestions must never merge automatically.
describe("dedup suggestions have no side effects", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("does not merge or retire any contact when suggestions are generated", async () => {
    await db.insert(contacts).values([contactRow("Pat Doe"), contactRow("Patt Doe")]);

    await SUGGESTIONS(jsonReq("GET", "/api/dedup/suggestions"), ctx());

    // Assert the intent directly — nothing was merged — rather than a total contact count, which
    // also counts the harness's standing staff member (feature 015).
    const merged = await db.select().from(contacts).where(isNotNull(contacts.mergedIntoId));
    expect(merged).toHaveLength(0);
    const active = await db.select().from(contacts).where(isNull(contacts.mergedIntoId));
    expect(active.map((c) => c.displayName)).toEqual(
      expect.arrayContaining(["Pat Doe", "Patt Doe"]),
    );
    const audits = await db.select().from(mergeAudit);
    expect(audits).toHaveLength(0);
  });
});
