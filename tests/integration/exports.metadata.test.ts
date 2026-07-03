import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeContactWithEmail } from "./helpers/factories";
import { makeEvent } from "./helpers/factories";
import { eventGroups, events } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { GET as METADATA } from "@/app/api/exports/route";
import { GET as DOWNLOAD } from "@/app/api/exports/[listId]/route";

// FR-005, FR-009, FR-010, Decision 6
describe("GET /api/exports", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("lists all 7 lists with lastExport null before any download", async () => {
    const res = await METADATA(jsonReq("GET", "/api/exports"), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(7);
    const contra = body.items.find((i: { listId: string }) => i.listId === "contra");
    expect(contra.filename).toBe("contra.csv");
    expect(contra.lastExport).toBeNull();
  });

  it("populates lastExport after a download", async () => {
    await makeContactWithEmail({ email: "a@example.com", consentTopics: ["contra"] });
    await DOWNLOAD(jsonReq("GET", "/api/exports/contra"), ctx({ listId: "contra" }));

    const res = await METADATA(jsonReq("GET", "/api/exports"), ctx());
    const body = await res.json();
    const contra = body.items.find((i: { listId: string }) => i.listId === "contra");
    expect(contra.lastExport.rowCount).toBe(1);
    expect(contra.lastExport.createdAt).toBeTruthy();
  });

  it("reflects the most recent JAB event's year in janeaustenball's note", async () => {
    const evt = await makeEvent({ eventDate: "2026-03-14" });
    const [group] = await db.insert(eventGroups).values({ name: "JAB 2026", kind: "jane_austen_ball" }).returning();
    await db.update(events).set({ groupId: group!.id }).where(eq(events.id, evt.id));

    const res = await METADATA(jsonReq("GET", "/api/exports"), ctx());
    const body = await res.json();
    const jab = body.items.find((i: { listId: string }) => i.listId === "janeaustenball");
    expect(jab.note).toContain("2026");
  });
});
