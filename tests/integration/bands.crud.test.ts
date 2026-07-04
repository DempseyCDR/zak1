import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makePerformer } from "./helpers/factories";
import { GET as LIST, POST as CREATE } from "@/app/api/bands/route";
import { GET as GET_ONE } from "@/app/api/bands/[id]/route";

// FR-001, FR-010
describe("band CRUD", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("creates a band with a roster and lists/gets it", async () => {
    const lead = await makePerformer("Fiona Lead");
    const m1 = await makePerformer("Mandy Member");

    const res = await CREATE(
      jsonReq("POST", "/api/bands", {
        name: "The Reels",
        bio: "A lively contra band.",
        members: [
          { performerId: lead.id, isLead: true },
          { performerId: m1.id, isLead: false },
        ],
      }),
      ctx(),
    );
    expect(res.status).toBe(201);
    const band = await res.json();

    const list = await LIST(jsonReq("GET", "/api/bands"), ctx());
    const items = (await list.json()).items;
    expect(items.map((b: { name: string }) => b.name)).toContain("The Reels");

    const one = await GET_ONE(jsonReq("GET", `/api/bands/${band.id}`), ctx({ id: band.id }));
    const detail = await one.json();
    expect(detail.members).toHaveLength(2);
    expect(detail.members.find((m: { isLead: boolean }) => m.isLead).performerId).toBe(lead.id);
  });

  it("404s for an unknown performer in the roster", async () => {
    const res = await CREATE(
      jsonReq("POST", "/api/bands", {
        name: "Ghost Band",
        members: [{ performerId: "00000000-0000-0000-0000-000000000009", isLead: true }],
      }),
      ctx(),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("PERFORMER_NOT_FOUND");
  });

  it("422s for a roster with two leads", async () => {
    const a = await makePerformer("A");
    const b = await makePerformer("B");
    const res = await CREATE(
      jsonReq("POST", "/api/bands", {
        name: "Two Leads",
        members: [
          { performerId: a.id, isLead: true },
          { performerId: b.id, isLead: true },
        ],
      }),
      ctx(),
    );
    expect(res.status).toBe(422);
  });
});
