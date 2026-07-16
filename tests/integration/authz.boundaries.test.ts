import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReqAs, ctx } from "./helpers/http";
import { db } from "@/server/db/client";
import { series } from "@/server/db/schema";
import { makeActor, makeEvent, makeDoorRecord } from "./helpers/factories";
import { GET as GET_DOOR, PATCH as PATCH_DOOR } from "@/app/api/door-records/[id]/route";

/**
 * US1 — the club's one hard boundary, and it is a WRITE boundary (SC-003, FR-020).
 *
 * The Door Attendant ✗ `/gate` rule is about WRITING the money, not seeing it. Money is open to every
 * volunteer (FR-015): a Door Attendant reads the gate figures like anyone else and simply cannot
 * change them. The Financial Secretary owns the money, scoped to their series.
 */

async function seriesId(key: string): Promise<string> {
  const row = await db.query.series.findFirst({ where: eq(series.key, key) });
  if (!row) throw new Error(`series ${key} not seeded`);
  return row.id;
}

describe("US1: the gate is a WRITE boundary", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  describe("Door Attendant (SC-003)", () => {
    it("READS the gate figures — money is not secret (FR-015)", async () => {
      const event = await makeEvent({ seriesKey: "tnc" });
      const drId = await makeDoorRecord(event.id);
      const { token } = await makeActor({
        email: "door@cdrochester.org",
        grants: [{ role: "door_attendant" }],
      });

      const res = await GET_DOOR(
        jsonReqAs(token, "GET", `/api/door-records/${drId}`),
        ctx({ id: drId }),
      );
      expect(res.status).toBe(200);
    });

    it("is REFUSED every write to the money — at every scope", async () => {
      const event = await makeEvent({ seriesKey: "tnc" });
      const drId = await makeDoorRecord(event.id);
      const { token } = await makeActor({
        email: "door2@cdrochester.org",
        grants: [{ role: "door_attendant" }],
      });

      const res = await PATCH_DOOR(
        jsonReqAs(token, "PATCH", `/api/door-records/${drId}`, { grossCash: 500 }),
        ctx({ id: drId }),
      );
      // Refused at layer 1: door_attendant's catalog row simply has no gate.write. Not a deny entry.
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("Financial Secretary, per series", () => {
    it("writes the money for their OWN series", async () => {
      const event = await makeEvent({ seriesKey: "tnc" });
      const drId = await makeDoorRecord(event.id);
      const { token } = await makeActor({
        email: "fs.tnc@cdrochester.org",
        grants: [{ role: "financial_secretary", seriesId: await seriesId("tnc") }],
      });

      const res = await PATCH_DOOR(
        jsonReqAs(token, "PATCH", `/api/door-records/${drId}`, { grossCash: 500 }),
        ctx({ id: drId }),
      );
      expect(res.status).toBe(200);
    });

    it("is REFUSED the money for ANOTHER series (layer 2 — the door record resolves to its event's series)", async () => {
      const ecdEvent = await makeEvent({ seriesKey: "ecd" });
      const drId = await makeDoorRecord(ecdEvent.id);
      const { token } = await makeActor({
        email: "fs.tnc2@cdrochester.org",
        grants: [{ role: "financial_secretary", seriesId: await seriesId("tnc") }],
      });

      const res = await PATCH_DOOR(
        jsonReqAs(token, "PATCH", `/api/door-records/${drId}`, { grossCash: 500 }),
        ctx({ id: drId }),
      );
      // Layer 1 passed (holds gate.write somewhere); layer 2 refuses it for ecd.
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    });

    it("...but still READS the other series' figures (money is open)", async () => {
      const ecdEvent = await makeEvent({ seriesKey: "ecd" });
      const drId = await makeDoorRecord(ecdEvent.id);
      const { token } = await makeActor({
        email: "fs.tnc3@cdrochester.org",
        grants: [{ role: "financial_secretary", seriesId: await seriesId("tnc") }],
      });

      const res = await GET_DOOR(
        jsonReqAs(token, "GET", `/api/door-records/${drId}`),
        ctx({ id: drId }),
      );
      expect(res.status).toBe(200);
    });
  });
});
