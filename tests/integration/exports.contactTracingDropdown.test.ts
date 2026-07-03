import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReq, ctx } from "./helpers/http";
import { makeEvent } from "./helpers/factories";
import { GET as LIST_EVENTS } from "@/app/api/events/route";

// FR-006b — purge-aware dropdown reuses feature 002's existing `from` filter, no new endpoint.
describe("GET /api/events?from= (contact-tracing dropdown)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("excludes an event older than the 90-day retention cutoff and includes a recent one", async () => {
    const old = await makeEvent({ eventDate: "2025-01-01" });
    const recent = await makeEvent({ eventDate: "2026-06-18" });

    const cutoff = "2026-04-01"; // stand-in for "today - 90 days"
    const res = await LIST_EVENTS(jsonReq("GET", `/api/events?from=${cutoff}`), ctx());
    const body = await res.json();
    const ids = body.items.map((e: { id: string }) => e.id);
    expect(ids).not.toContain(old.id);
    expect(ids).toContain(recent.id);
  });
});
