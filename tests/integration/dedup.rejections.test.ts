import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { contacts } from "@/server/db/schema";
import { getMergeSuggestions } from "@/server/domain/dedup/suggestionService";
import { POST as REJECT, DELETE as UNREJECT } from "@/app/api/dedup/rejections/route";
import { PATCH as UPDATE_CONTACT } from "@/app/api/contacts/[id]/route";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

/**
 * Feature 069, US1 — "these are not duplicates" (M-R18).
 *
 * The rejection is judged by comparing the two names AS RECORDED against the two names as they now stand
 * (FR-003a). Nothing has to remember to clear a flag: the suppression simply stops applying the moment a
 * name differs, through every path that can change one — including paths added after this feature.
 */
describe("rejecting a duplicate pair", () => {
  async function pair() {
    const [a] = await db.insert(contacts).values(names("Cris", "Jones")).returning();
    const [b] = await db.insert(contacts).values(names("Chris", "Jones")).returning();
    return { aId: a!.id, bId: b!.id };
  }

  function names(firstName: string, lastName: string) {
    const dn = `${firstName} ${lastName}`;
    return {
      firstName,
      lastName,
      displayName: dn,
      nameNormalized: dn.toLowerCase(),
      dedupNormalized: dn.toLowerCase(),
    };
  }

  const suggested = async (aId: string, bId: string) =>
    (await getMergeSuggestions(db)).some(
      (p) => (p.a.id === aId && p.b.id === bId) || (p.a.id === bId && p.b.id === aId),
    );

  const reject = (contactAId: string, contactBId: string) =>
    REJECT(jsonReq("POST", "/api/dedup/rejections", { contactAId, contactBId }), ctx());

  it("suppresses the pair, and un-rejecting returns it", async () => {
    const { aId, bId } = await pair();
    expect(await suggested(aId, bId)).toBe(true);

    expect((await reject(aId, bId)).status).toBe(200);
    expect(await suggested(aId, bId)).toBe(false);

    const del = await UNREJECT(
      jsonReq("DELETE", "/api/dedup/rejections", { contactAId: aId, contactBId: bId }),
      ctx(),
    );
    expect(del.status).toBe(200);
    expect(await suggested(aId, bId)).toBe(true);
  });

  it("is idempotent and accepts the two ids in either order", async () => {
    const { aId, bId } = await pair();
    expect((await reject(aId, bId)).status).toBe(200);
    expect((await reject(bId, aId)).status).toBe(200);
    expect(await suggested(aId, bId)).toBe(false);
  });

  it("refuses SAME_CONTACT", async () => {
    const { aId } = await pair();
    const res = await reject(aId, aId);
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("SAME_CONTACT");
  });

  it("lapses when a structured name changes — with no write to the rejection (FR-003)", async () => {
    const { aId, bId } = await pair();
    await reject(aId, bId);
    expect(await suggested(aId, bId)).toBe(false);

    const before = await db.query.dedupRejections.findMany();
    await UPDATE_CONTACT(
      jsonReq("PATCH", `/api/contacts/${aId}`, { firstName: "Cristobal" }),
      ctx({ id: aId }),
    );
    expect(await suggested(aId, bId)).toBe(true);
    // The rejection row is untouched — the lapse is a property of the data, not a maintained flag.
    expect(await db.query.dedupRejections.findMany()).toEqual(before);
  });

  it("re-suppresses when the name is changed back", async () => {
    const { aId, bId } = await pair();
    await reject(aId, bId);
    await UPDATE_CONTACT(
      jsonReq("PATCH", `/api/contacts/${aId}`, { firstName: "Cristobal" }),
      ctx({ id: aId }),
    );
    expect(await suggested(aId, bId)).toBe(true);

    await UPDATE_CONTACT(
      jsonReq("PATCH", `/api/contacts/${aId}`, { firstName: "Cris" }),
      ctx({ id: aId }),
    );
    expect(await suggested(aId, bId)).toBe(false);
  });

  it("does NOT lapse when only a display-name override changes (FR-003)", async () => {
    const { aId, bId } = await pair();
    await reject(aId, bId);
    await UPDATE_CONTACT(
      jsonReq("PATCH", `/api/contacts/${aId}`, { displayNameOverride: "C. Jones" }),
      ctx({ id: aId }),
    );
    expect(await suggested(aId, bId)).toBe(false);
  });

  it("records who rejected it and when, and reveals it from the queue (FR-004, FR-004a)", async () => {
    const { aId, bId } = await pair();
    await reject(aId, bId);

    const revealed = await getMergeSuggestions(db, 0.4, 50, undefined, { includeRejected: true });
    const row = revealed.find((p) => p.a.id === aId || p.b.id === aId);
    expect(row?.rejected).toBeTruthy();
    expect(row?.rejected?.byDisplayName).toBeTruthy();
    expect(row?.rejected?.at).toBeTruthy();
  });
});
