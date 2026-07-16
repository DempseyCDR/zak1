import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReqAs, ctx } from "./helpers/http";
import { db } from "@/server/db/client";
import { contacts, eventGroups, events, performers, series } from "@/server/db/schema";
import { makeActor, makeBaseActor, makeEvent } from "./helpers/factories";
import { POST as CREATE_EVENT, GET as LIST_EVENTS } from "@/app/api/events/route";
import { POST as CREATE_BOOKING } from "@/app/api/events/[id]/bookings/route";
import { POST as CREATE_RATE } from "@/app/api/rate-parameters/route";

/**
 * US1 — grants are enforced, with scope. The heart of the feature.
 *
 * Every actor here is built by `makeActor`: the standing harness session is a club-wide super_user
 * (research R12) and can do anything, so asserting against it would prove nothing.
 */

async function seriesId(key: string): Promise<string> {
  const row = await db.query.series.findFirst({ where: eq(series.key, key) });
  if (!row) throw new Error(`series ${key} not seeded`);
  return row.id;
}

async function makeGroup(name: string): Promise<string> {
  const [row] = await db.insert(eventGroups).values({ name }).returning();
  if (!row) throw new Error("group insert failed");
  return row.id;
}

function createEventReq(token: string, body: Record<string, unknown>) {
  return CREATE_EVENT(jsonReqAs(token, "POST", "/api/events", body), ctx());
}

describe("US1: grants are enforced, with scope", () => {
  // ONE lifecycle for the file: closeDb() ends a shared pool, so a per-describe afterAll would tear
  // it down for every later block.
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  describe("per-series scope (SC-002)", () => {
    it("a Booker-of-ecd creates an ecd event", async () => {
      const ecd = await seriesId("ecd");
      const { token } = await makeActor({
        email: "booker.ecd@cdrochester.org",
        grants: [{ role: "booker", seriesId: ecd }],
      });

      const res = await createEventReq(token, { seriesKey: "ecd", eventDate: "2026-09-06" });
      expect(res.status).toBe(201);
    });

    it("...and is REFUSED on tnc, with no data change", async () => {
      const ecd = await seriesId("ecd");
      const { token } = await makeActor({
        email: "booker.ecd2@cdrochester.org",
        grants: [{ role: "booker", seriesId: ecd }],
      });

      const before = await db.select().from(events);
      const res = await createEventReq(token, { seriesKey: "tnc", eventDate: "2026-09-10" });

      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("UNAUTHORIZED");
      // "no data change" is the half that matters: a refusal that still wrote would be worse than none.
      expect(await db.select().from(events)).toHaveLength(before.length);
    });

    it("a Booker of BOTH series may act on both (FR-005)", async () => {
      const { token } = await makeActor({
        email: "booker.both@cdrochester.org",
        grants: [
          { role: "booker", seriesId: await seriesId("ecd") },
          { role: "booker", seriesId: await seriesId("tnc") },
        ],
      });

      expect(
        (await createEventReq(token, { seriesKey: "ecd", eventDate: "2026-09-06" })).status,
      ).toBe(201);
      expect(
        (await createEventReq(token, { seriesKey: "tnc", eventDate: "2026-09-10" })).status,
      ).toBe(201);
    });
  });

  describe("group scope is ORTHOGONAL to series (SC-005)", () => {
    it("reaches an event in a series the holder has NO series grant for", async () => {
      // "Thanksgiving 2026" spans tnc + ecd. The holder has no series grant at all.
      const groupId = await makeGroup("Thanksgiving 2026");
      const { token } = await makeActor({
        email: "shortterm@example.com",
        grants: [{ role: "booker", groupId }],
      });

      const res = await createEventReq(token, {
        seriesKey: "ecd",
        eventDate: "2026-11-26",
        groupId,
      });
      expect(res.status).toBe(201); // intended, not a leak — event groups deliberately span series
    });

    it("is REFUSED for the same series OUTSIDE the group", async () => {
      const groupId = await makeGroup("Thanksgiving 2026");
      const { token } = await makeActor({
        email: "shortterm2@example.com",
        grants: [{ role: "booker", groupId }],
      });

      const res = await createEventReq(token, { seriesKey: "ecd", eventDate: "2026-12-06" });
      expect(res.status).toBe(403);
    });
  });

  describe("the Organizer base (FR-001, FR-002, FR-015, SC-004)", () => {
    it("reads the schedule for every series", async () => {
      const { token } = await makeBaseActor("base.reader@example.com");
      const res = await LIST_EVENTS(jsonReqAs(token, "GET", "/api/events"), ctx());
      expect(res.status).toBe(200);
    });

    it("writes NOTHING — refused with 403, naming the capability", async () => {
      const { token } = await makeBaseActor("base.writer@example.com");
      const res = await createEventReq(token, { seriesKey: "ecd", eventDate: "2026-09-06" });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
      // FR-026: the refusal NAMES what was refused. The actor could already read this; concealing the
      // reason protects nothing and only costs them the ability to understand what happened.
      expect(body.error.message).toContain("event.write");
    });
  });

  describe("supersets (FR-009, FR-010, FR-012)", () => {
    it("a Super-user writes anything", async () => {
      const { token } = await makeActor({
        email: "su@cdrochester.org",
        grants: [{ role: "super_user" }],
      });
      expect(
        (await createEventReq(token, { seriesKey: "tnc", eventDate: "2026-09-10" })).status,
      ).toBe(201);
    });

    it("a Treasurer is NOT thereby a Booker — the supersets are only the three", async () => {
      const { token } = await makeActor({
        email: "treas@cdrochester.org",
        grants: [{ role: "treasurer" }],
      });
      expect(
        (await createEventReq(token, { seriesKey: "tnc", eventDate: "2026-09-10" })).status,
      ).toBe(403);
    });
  });

  describe("scope reaches the second-order resources too (T029)", () => {
    it("a Booker-of-ecd books a performer on an ecd event, and is refused on tnc", async () => {
      const ecd = await seriesId("ecd");
      const { token } = await makeActor({
        email: "booker.bk@cdrochester.org",
        grants: [{ role: "booker", seriesId: ecd }],
      });
      const ecdEvent = await makeEvent({ seriesKey: "ecd" });
      const tncEvent = await makeEvent({ seriesKey: "tnc" });
      const perf = await db.query.performers.findFirst();
      // Seed a performer if none exists.
      const performerId =
        perf?.id ??
        (await db.insert(performers).values({ displayName: "Caller" }).returning())[0]!.id;

      const ok = await CREATE_BOOKING(
        jsonReqAs(token, "POST", `/api/events/${ecdEvent.id}/bookings`, {
          performerId,
          performerType: "caller",
        }),
        ctx({ id: ecdEvent.id }),
      );
      expect(ok.status).toBe(201);

      const denied = await CREATE_BOOKING(
        jsonReqAs(token, "POST", `/api/events/${tncEvent.id}/bookings`, {
          performerId,
          performerType: "caller",
        }),
        ctx({ id: tncEvent.id }),
      );
      expect(denied.status).toBe(403); // booking scope resolves to the EVENT's series
    });

    it("a Booker sets their own series' rate parameter, and is refused another series' (row 9)", async () => {
      const { token } = await makeActor({
        email: "booker.param@cdrochester.org",
        grants: [{ role: "booker", seriesId: await seriesId("ecd") }],
      });

      const own = await CREATE_RATE(
        jsonReqAs(token, "POST", "/api/rate-parameters", {
          seriesKey: "ecd",
          kind: "caller",
          amount: 100,
          effectiveDate: "2026-01-01",
        }),
        ctx(),
      );
      expect(own.status).toBe(201);

      const other = await CREATE_RATE(
        jsonReqAs(token, "POST", "/api/rate-parameters", {
          seriesKey: "tnc",
          kind: "caller",
          amount: 100,
          effectiveDate: "2026-01-01",
        }),
        ctx(),
      );
      expect(other.status).toBe(403);
    });

    it("a Treasurer sets ANY series' parameter (⊇, row 9)", async () => {
      const { token } = await makeActor({
        email: "treas.param@cdrochester.org",
        grants: [{ role: "treasurer" }],
      });
      const res = await CREATE_RATE(
        jsonReqAs(token, "POST", "/api/rate-parameters", {
          seriesKey: "tnc",
          kind: "caller",
          amount: 100,
          effectiveDate: "2026-01-01",
        }),
        ctx(),
      );
      expect(res.status).toBe(201);
    });
  });

  describe("authority is evaluated LIVE (FR-014, SC-006)", () => {
    it("clearing is_volunteer denies every grant on the NEXT request — no sign-out", async () => {
      const ecd = await seriesId("ecd");
      const { contactId, token } = await makeActor({
        email: "leaver@cdrochester.org",
        grants: [{ role: "booker", seriesId: ecd }],
      });

      expect(
        (await createEventReq(token, { seriesKey: "ecd", eventDate: "2026-09-06" })).status,
      ).toBe(201);

      // The President clears their designation. The session row is untouched.
      await db.update(contacts).set({ isVolunteer: false }).where(eq(contacts.id, contactId));

      // readSession joins contacts.is_volunteer live, so the very next request is 401 — that live join
      // is what makes revocation work without a sweep (015's FR-011, inherited here).
      const after = await createEventReq(token, { seriesKey: "ecd", eventDate: "2026-09-13" });
      expect(after.status).toBe(401);
    });
  });
});
