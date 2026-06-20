import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { isNull } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts, mergeAudit } from "@/server/db/schema";
import { normalizeName } from "@/server/domain/contacts/normalize";
import { GET as SUGGESTIONS } from "@/app/api/dedup/suggestions/route";
import { jsonReq, ctx } from "./helpers/http";

// FR-011: generating suggestions must never merge automatically.
describe("dedup suggestions have no side effects", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("does not merge or retire any contact when suggestions are generated", async () => {
    await db.insert(contacts).values([
      { displayName: "Pat Doe", nameNormalized: normalizeName("Pat Doe") },
      { displayName: "Patt Doe", nameNormalized: normalizeName("Patt Doe") },
    ]);

    await SUGGESTIONS(jsonReq("GET", "/api/dedup/suggestions"), ctx());

    const active = await db.select().from(contacts).where(isNull(contacts.mergedIntoId));
    expect(active).toHaveLength(2);
    const audits = await db.select().from(mergeAudit);
    expect(audits).toHaveLength(0);
  });
});
