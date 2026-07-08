import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts } from "@/server/db/schema";
import { contactRow } from "./helpers/factories";
import { GET as SUGGESTIONS } from "@/app/api/dedup/suggestions/route";
import { jsonReq, ctx } from "./helpers/http";

// FR-010
describe("GET /api/dedup/suggestions", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  async function seed(name: string) {
    await db.insert(contacts).values(contactRow(name));
  }

  it("surfaces similar-name pairs with a similarity score", async () => {
    await seed("Jon Smith");
    await seed("John Smith");
    await seed("Zelda Fitzgerald");

    const res = await SUGGESTIONS(jsonReq("GET", "/api/dedup/suggestions"), ctx());
    const body = await res.json();
    expect(body.pairs.length).toBeGreaterThanOrEqual(1);
    const pair = body.pairs[0];
    const names = [pair.a.displayName, pair.b.displayName].sort();
    expect(names).toEqual(["John Smith", "Jon Smith"]);
    expect(pair.similarity).toBeGreaterThan(0.4);
  });
});
