import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { desc, eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb } from "./helpers/db";
import { jsonReqAs, ctx } from "./helpers/http";
import { db } from "@/server/db/client";
import { auditEvents } from "@/server/db/schema";
import { makeActor, makeBaseActor, makeContactWithEmail } from "./helpers/factories";
import { GET as GET_CONTACT } from "@/app/api/contacts/[id]/route";
import { GET as SEARCH } from "@/app/api/attendance/search/route";

/**
 * US4 — PII on lookup, names in bulk (FR-016, FR-016a, FR-017, FR-017b).
 *
 * Every volunteer reads all but contact PII (emails + phone numbers). PII rides on the roles whose jobs
 * need it; the bare Organizer base is excluded. Disclosures are audited per request with a count, so a
 * bulk harvest is detectable even though it is not blocked.
 */

async function aContact(email: string, phone: string): Promise<string> {
  const { contactId } = await makeContactWithEmail({
    firstName: "Jane",
    lastName: "Dancer",
    email,
    phone,
  });
  return contactId;
}

describe("US4: PII read + disclosure", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  describe("the base is excluded from PII (FR-016)", () => {
    it("a base-only volunteer reads a contact but gets NO email or phone", async () => {
      const id = await aContact("jane@example.com", "555-0100");
      const { token } = await makeBaseActor("base@cdrochester.org");

      const res = await GET_CONTACT(jsonReqAs(token, "GET", `/api/contacts/${id}`), ctx({ id }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.displayName).toContain("Jane"); // name is readable
      expect(body.phone).toBeNull(); // PII stripped
      expect(body.emails).toEqual([]);
    });

    it("a base-only volunteer's contact search returns NO emails", async () => {
      await aContact("harvest@example.com", "555-0101");
      const { token } = await makeBaseActor("base2@cdrochester.org");

      const res = await SEARCH(jsonReqAs(token, "GET", "/api/attendance/search?q=Jane"), ctx());
      const body = await res.json();
      for (const item of body.items) expect(item.emails).toEqual([]);
    });
  });

  describe("PII rides on the roles that need it (FR-016a)", () => {
    it("a Door Attendant matching a dancer SEES their PII", async () => {
      const id = await aContact("jane2@example.com", "555-0102");
      const { token } = await makeActor({
        email: "door@cdrochester.org",
        grants: [{ role: "door_attendant" }],
      });

      const res = await GET_CONTACT(jsonReqAs(token, "GET", `/api/contacts/${id}`), ctx({ id }));
      const body = await res.json();
      expect(body.phone).toBe("555-0102");
      expect(body.emails.map((e: { email: string }) => e.email)).toContain("jane2@example.com");
    });

    it("a Booker sees PII (performer contact); a Treasurer sees PII (membership)", async () => {
      const id = await aContact("jane3@example.com", "555-0103");
      for (const [role, email] of [
        ["booker", "bk@cdrochester.org"],
        ["treasurer", "tr@cdrochester.org"],
      ] as const) {
        const { token } = await makeActor({ email, grants: [{ role }] });
        const res = await GET_CONTACT(jsonReqAs(token, "GET", `/api/contacts/${id}`), ctx({ id }));
        expect((await res.json()).phone).toBe("555-0103");
      }
    });
  });

  describe("disclosure is audited per request with a count (FR-017b)", () => {
    it("a search returning several contacts writes ONE pii.disclosed row, not one per contact", async () => {
      await aContact("a.dancer@example.com", "555-1");
      await aContact("b.dancer@example.com", "555-2");
      await aContact("c.dancer@example.com", "555-3");
      const { contactId, token } = await makeActor({
        email: "door2@cdrochester.org",
        grants: [{ role: "door_attendant" }],
      });

      await SEARCH(jsonReqAs(token, "GET", "/api/attendance/search?q=Dancer"), ctx());

      const rows = await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.kind, "pii.disclosed"))
        .orderBy(desc(auditEvents.occurredAt));
      expect(rows).toHaveLength(1); // ONE row, not three
      expect(rows[0]?.actorContactId).toBe(contactId);
      expect((rows[0]?.details as { count: number }).count).toBeGreaterThanOrEqual(3);
    });

    it("a base volunteer's PII-free read writes NO disclosure row", async () => {
      const id = await aContact("quiet@example.com", "555-4");
      const { token } = await makeBaseActor("base3@cdrochester.org");
      await GET_CONTACT(jsonReqAs(token, "GET", `/api/contacts/${id}`), ctx({ id }));
      const rows = await db.select().from(auditEvents).where(eq(auditEvents.kind, "pii.disclosed"));
      expect(rows).toHaveLength(0);
    });

    it("a single-contact lookup by a PII holder writes one row with count 1", async () => {
      const id = await aContact("one@example.com", "555-5");
      const { token } = await makeActor({
        email: "fs@cdrochester.org",
        grants: [{ role: "treasurer" }],
      });
      await GET_CONTACT(jsonReqAs(token, "GET", `/api/contacts/${id}`), ctx({ id }));
      const [row] = await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.kind, "pii.disclosed"));
      expect((row?.details as { count: number }).count).toBe(1);
    });
  });
});
