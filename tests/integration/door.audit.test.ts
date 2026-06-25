import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent } from "./helpers/factories";
import { doorRecordAudit } from "@/server/db/schema";
import { POST as CREATE_DR } from "@/app/api/door-records/route";
import { PATCH as PATCH_DR } from "@/app/api/door-records/[id]/route";

// FR-012
describe("door-record audit", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("writes an audit entry on creation and on edit", async () => {
    const evt = await makeEvent();
    const drRes = await CREATE_DR(jsonReq("POST", "/api/door-records", { eventId: evt.id }), ctx());
    const id = (await drRes.json()).id as string;

    await PATCH_DR(
      jsonReq("PATCH", `/api/door-records/${id}`, { posTransactionCount: 5 }),
      ctx({ id }),
    );

    const audits = await db
      .select()
      .from(doorRecordAudit)
      .where(eq(doorRecordAudit.doorRecordId, id));
    const actions = audits.map((a) => a.action).sort();
    expect(actions).toEqual(["created", "updated"]);
    expect(audits.every((a) => a.actor !== null)).toBe(true);
  });
});
