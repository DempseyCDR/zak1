import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { makeEvent } from "./helpers/factories";
import { series } from "@/server/db/schema";
import {
  createDoorParameter,
  resolveParameterCentsOrNull,
} from "@/server/domain/parameters/seriesParameterService";
import {
  createDoorRecord,
  getDoorRecord,
  updateDoorRecord,
} from "@/server/domain/door/doorRecordService";

async function seriesId(key: string): Promise<string> {
  const s = await db.query.series.findFirst({ where: eq(series.key, key) });
  if (!s) throw new Error(`series ${key} missing`);
  return s.id;
}

// Feature 019 US5 (FR-021..FR-026): the seed float is a per-series, effective-dated parameter. The gate
// override stays per-record; existing records keep their float; unconfigured series fall back to the club
// default. resolveParameterCentsOrNull distinguishes "unconfigured" (null) from "configured $0".
describe("configurable door seed float", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("resolveParameterCentsOrNull returns null when unconfigured", async () => {
    const sid = await seriesId("tnc");
    expect(
      await resolveParameterCentsOrNull(db, {
        category: "door",
        kind: "seed_float",
        seriesId: sid,
        onDate: "2026-06-18",
      }),
    ).toBeNull();
  });

  it("resolves the latest effective value, and 0 is distinct from unconfigured", async () => {
    await createDoorParameter(db, { seriesKey: "tnc", amount: 20, effectiveDate: "2026-01-01" });
    const sid = await seriesId("tnc");
    expect(
      await resolveParameterCentsOrNull(db, {
        category: "door",
        kind: "seed_float",
        seriesId: sid,
        onDate: "2026-06-18",
      }),
    ).toBe(2000);
    await createDoorParameter(db, { seriesKey: "tnc", amount: 0, effectiveDate: "2026-06-01" });
    expect(
      await resolveParameterCentsOrNull(db, {
        category: "door",
        kind: "seed_float",
        seriesId: sid,
        onDate: "2026-06-18",
      }),
    ).toBe(0); // configured zero, NOT null
  });

  it("a new door record takes the configured seed float", async () => {
    await createDoorParameter(db, { seriesKey: "tnc", amount: 20, effectiveDate: "2026-01-01" });
    const evt = await makeEvent({ seriesKey: "tnc" }); // 2026-06-18
    const dr = await createDoorRecord(db, evt.id, "test");
    expect(dr.seedFloat).toBe(20);
  });

  it("an unconfigured series falls back to the $15 club default", async () => {
    const evt = await makeEvent({ seriesKey: "tnc" });
    const dr = await createDoorRecord(db, evt.id, "test");
    expect(dr.seedFloat).toBe(15);
  });

  it("a configured $0 float is honored (not the default)", async () => {
    await createDoorParameter(db, { seriesKey: "tnc", amount: 0, effectiveDate: "2026-01-01" });
    const evt = await makeEvent({ seriesKey: "tnc" });
    const dr = await createDoorRecord(db, evt.id, "test");
    expect(dr.seedFloat).toBe(0);
  });

  it("changing the parameter does NOT alter an existing door record (FR-025)", async () => {
    await createDoorParameter(db, { seriesKey: "tnc", amount: 20, effectiveDate: "2026-01-01" });
    const evt = await makeEvent({ seriesKey: "tnc" });
    const dr = await createDoorRecord(db, evt.id, "test");
    expect(dr.seedFloat).toBe(20);
    // Later the club raises the float — the already-open record is untouched (float copied at creation).
    await createDoorParameter(db, { seriesKey: "tnc", amount: 30, effectiveDate: "2026-07-01" });
    const view = await getDoorRecord(db, dr.id);
    expect(view.doorRecord.seedFloat).toBe(20);
  });

  it("the per-record override still applies to that record only (FR-023)", async () => {
    await createDoorParameter(db, { seriesKey: "tnc", amount: 20, effectiveDate: "2026-01-01" });
    const evt = await makeEvent({ seriesKey: "tnc" });
    const dr = await createDoorRecord(db, evt.id, "test");
    const updated = await updateDoorRecord(db, dr.id, { seedFloat: 25 }, "test");
    expect(updated.seedFloat).toBe(25);
    // The series parameter is unchanged.
    const sid = await seriesId("tnc");
    expect(
      await resolveParameterCentsOrNull(db, {
        category: "door",
        kind: "seed_float",
        seriesId: sid,
        onDate: "2026-06-18",
      }),
    ).toBe(2000);
  });
});
