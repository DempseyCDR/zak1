import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { and, eq, gt, sql as raw } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { db } from "@/server/db/client";
import { auditEvents } from "@/server/db/schema";
import { recordAudit } from "@/server/lib/audit";
import { makeVolunteerContact } from "./helpers/factories";

/**
 * The audit trail is a TABLE, not log lines (research R8).
 *
 * `writeAudit` has only ever called `logger.info`, and said so in its own comment: "For the MVP the
 * audit sink is the structured log; dedicated audit tables are introduced with those stories." This is
 * that story: SC-014 requires "which volunteer saw the most contacts' PII last month, and how many" to
 * be answerable **in SQL, without scanning application logs**, and FR-032 requires a durable
 * grant/revoke trail.
 */
describe("audit_events (R8, FR-032, SC-014)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("persists a row, not just a log line", async () => {
    const { contactId } = await makeVolunteerContact({
      firstName: "Ada",
      email: "ada@cdrochester.org",
    });

    await recordAudit(db, {
      kind: "authz.grant.created",
      actorContactId: contactId,
      details: { subject: contactId, role: "booker", seriesId: null, groupId: null },
    });

    const rows = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.kind, "authz.grant.created"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.actorContactId).toBe(contactId);
    expect(rows[0]?.details).toMatchObject({ role: "booker" });
    expect(rows[0]?.occurredAt).toBeInstanceOf(Date);
  });

  it("accepts a null actor for system/CLI-issued events", async () => {
    // The operator CLI has no signed-in actor — FR-033's bootstrap path.
    await recordAudit(db, { kind: "authz.grant.created", actorContactId: null, details: {} });
    const [row] = await db.select().from(auditEvents);
    expect(row?.actorContactId).toBeNull();
  });

  it("answers SC-014 in SQL: which volunteer saw the most contacts' PII, and how many", async () => {
    const nosy = await makeVolunteerContact({ firstName: "Nosy", email: "nosy@cdrochester.org" });
    const quiet = await makeVolunteerContact({
      firstName: "Quiet",
      email: "quiet@cdrochester.org",
    });

    // Per REQUEST, with a count — never per contact (FR-017b). Three searches, 20+20+5 disclosed.
    for (const count of [20, 20, 5]) {
      await recordAudit(db, {
        kind: "pii.disclosed",
        actorContactId: nosy.contactId,
        details: { surface: "attendance.search", count },
      });
    }
    await recordAudit(db, {
      kind: "pii.disclosed",
      actorContactId: quiet.contactId,
      details: { surface: "contacts.get", count: 1 },
    });

    // This is SC-014's question, verbatim, in SQL — no log access.
    const leaderboard = await db
      .select({
        actorContactId: auditEvents.actorContactId,
        contactsSeen: raw<number>`sum((${auditEvents.details}->>'count')::int)`,
        requests: raw<number>`count(*)`,
      })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.kind, "pii.disclosed"),
          gt(auditEvents.occurredAt, raw`now() - interval '30 days'`),
        ),
      )
      .groupBy(auditEvents.actorContactId)
      .orderBy(raw`sum((${auditEvents.details}->>'count')::int) DESC`);

    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0]?.actorContactId).toBe(nosy.contactId);
    expect(Number(leaderboard[0]?.contactsSeen)).toBe(45);
    // 3 requests for 45 contacts — the granularity that makes this affordable (FR-017b).
    expect(Number(leaderboard[0]?.requests)).toBe(3);
    expect(Number(leaderboard[1]?.contactsSeen)).toBe(1);
  });

  it("writes inside a caller's transaction, so an aborted change leaves no audit row", async () => {
    const { contactId } = await makeVolunteerContact({
      firstName: "Rollback",
      email: "rb@cdrochester.org",
    });

    await expect(
      db.transaction(async (tx) => {
        await recordAudit(tx, {
          kind: "authz.grant.created",
          actorContactId: contactId,
          details: {},
        });
        throw new Error("caller aborted");
      }),
    ).rejects.toThrow(/aborted/);

    // The grant/revoke trail must not claim things that did not happen.
    expect(await db.select().from(auditEvents)).toEqual([]);
  });
});
