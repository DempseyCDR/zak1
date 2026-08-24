import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, jsonReqAs, ctx } from "./helpers/http";
import { makeActor, makeBand, makePerformer } from "./helpers/factories";
import { performers, bands } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { PATCH as PATCH_PERFORMER } from "@/app/api/performers/[id]/route";
import { PATCH as PATCH_BAND } from "@/app/api/bands/[id]/route";

// Feature 053 (P7-R9): the roster fields ride the existing performer/band PATCH routes, which are default-deny
// — only `performer.write` may write them (FR-008). The standing jsonReq session is a super_user (holds
// performer.write) for the allow case.
describe("performer/band roster writes require performer.write", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("refuses a base-only actor on PATCH /api/performers/[id] — 403 naming performer.write", async () => {
    const perf = await makePerformer("Base Denied");
    const { token } = await makeActor({
      email: "nope@cdrochester.org",
      grants: [{ role: "door_attendant" }], // no performer.write
    });
    const res = await PATCH_PERFORMER(
      jsonReqAs(token, "PATCH", `/api/performers/${perf.id}`, { isPublic: true, isCaller: true }),
      ctx({ id: perf.id }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toContain("performer.write");
  });

  it("refuses a base-only actor on PATCH /api/bands/[id]", async () => {
    const band = await makeBand("Base Denied Band");
    const { token } = await makeActor({
      email: "nope2@cdrochester.org",
      grants: [{ role: "door_attendant" }],
    });
    const res = await PATCH_BAND(
      jsonReqAs(token, "PATCH", `/api/bands/${band.id}`, { isPublic: true, styles: ["contra"] }),
      ctx({ id: band.id }),
    );
    expect(res.status).toBe(403);
  });

  it("allows a performer.write actor and the roster fields persist", async () => {
    const perf = await makePerformer("Cathy Caller");
    const pres = await PATCH_PERFORMER(
      jsonReq("PATCH", `/api/performers/${perf.id}`, {
        isPublic: true,
        isCaller: true,
        styles: ["english"],
        links: [{ type: "website", url: "https://caller.example" }],
      }),
      ctx({ id: perf.id }),
    );
    expect(pres.status).toBe(200);
    const savedPerf = await db.query.performers.findFirst({ where: eq(performers.id, perf.id) });
    expect(savedPerf?.isPublic).toBe(true);
    expect(savedPerf?.isCaller).toBe(true);
    expect(savedPerf?.styles).toEqual(["english"]);
    expect(savedPerf?.links[0]!.url).toBe("https://caller.example");

    const band = await makeBand("The Free Raisins");
    const bres = await PATCH_BAND(
      jsonReq("PATCH", `/api/bands/${band.id}`, { isPublic: true, styles: ["contra"] }),
      ctx({ id: band.id }),
    );
    expect(bres.status).toBe(200);
    const savedBand = await db.query.bands.findFirst({ where: eq(bands.id, band.id) });
    expect(savedBand?.isPublic).toBe(true);
    expect(savedBand?.styles).toEqual(["contra"]);
  });
});
