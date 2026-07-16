import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { desc, eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReqAs, ctx } from "./helpers/http";
import { db } from "@/server/db/client";
import { auditEvents } from "@/server/db/schema";
import { makeActor } from "./helpers/factories";
import { POST as CREATE_EVENT } from "@/app/api/events/route";

/**
 * US1 — a refusal is EXPLICIT and AUDITED (FR-026, FR-026b, SC-012).
 *
 * 403, not 401 and not 404 and not a redirect. Because the base reads nearly everything (FR-015), a
 * refusal conceals nothing the actor could not already see, so it NAMES the capability — the opposite
 * posture to 015's deliberately-silent 401. Every refusal is recorded server-side.
 */
describe("US1: refusal shape and audit", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("returns 403 UNAUTHORIZED naming the capability — not 401/404/redirect", async () => {
    const { token } = await makeActor({
      email: "underprivileged@cdrochester.org",
      grants: [{ role: "door_attendant" }], // holds no event.write
    });

    const res = await CREATE_EVENT(
      jsonReqAs(token, "POST", "/api/events", { seriesKey: "ecd", eventDate: "2026-09-06" }),
      ctx(),
    );

    expect(res.status).toBe(403);
    expect(res.status).not.toBe(401); // 401 is "who are you?" — this actor is known
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toContain("event.write");
  });

  it("records the refusal in audit_events as authz.refused", async () => {
    const { contactId, token } = await makeActor({
      email: "watched@cdrochester.org",
      grants: [{ role: "door_attendant" }],
    });

    await CREATE_EVENT(
      jsonReqAs(token, "POST", "/api/events", { seriesKey: "ecd", eventDate: "2026-09-06" }),
      ctx(),
    );

    const [row] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.kind, "authz.refused"))
      .orderBy(desc(auditEvents.occurredAt))
      .limit(1);

    expect(row).toBeDefined();
    expect(row?.actorContactId).toBe(contactId);
    expect(row?.details).toMatchObject({ capability: "event.write" });
  });
});
