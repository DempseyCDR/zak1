import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contactEmails, contacts } from "@/server/db/schema";
import { contactRow, makeContactWithEmail } from "./helpers/factories";
import { jsonReq, ctx } from "./helpers/http";
import { GET as EXPORT } from "@/app/api/exports/[listId]/route";
import { attachMember, recordDuesPayment } from "@/server/domain/membership/accountService";
import { linkMessageRecipient } from "@/server/domain/contacts/referenceService";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

/**
 * Feature 068 (US3): the member list is built from ATTACHMENT and carries the payer's level, so the club
 * can send a thank-you to current members, a reminder to the lapsed, and a "we miss you" to the long
 * lapsed — segmented from the exported file alone.
 *
 * These assert on the CSV the ROUTE returns, not on `buildListRows`. The column list lives in the route,
 * so a service-level test would pass while the download silently lacked the new column.
 */
describe("member list export (feature 068)", () => {
  async function memberCsv(): Promise<string> {
    const res = await EXPORT(jsonReq("GET", "/api/exports/member"), ctx({ listId: "member" }));
    return res.text();
  }

  const future = () => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d.toISOString().slice(0, 10);
  };
  /**
   * A payment old enough that its coverage has genuinely expired. NOT "a couple of months ago": the club's
   * 2-month early-renewal grace rolls a recent payment to the NEXT year-end, so a July payment is covered
   * until the following August. 18 months back lands an expiry about a year in the past — lapsed, but
   * inside the 3-cycle window, so not yet long-lapsed.
   */
  const longAgo = () => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - 18);
    return d.toISOString().slice(0, 10);
  };

  it("carries membership_level in the downloaded file, alongside the existing columns (FR-013)", async () => {
    const payer = await makeContactWithEmail({
      firstName: "Cindy",
      lastName: "Culbert",
      email: "cindy@example.com",
    });
    await recordDuesPayment(
      db,
      payer.contactId,
      { level: "supporter", paymentDate: future() },
      null,
    );

    const csv = await memberCsv();
    const header = csv.split("\n")[0]!;
    expect(header).toContain("membership_level");
    // The columns that were already there are untouched.
    for (const col of ["email", "first_name", "last_name", "membership_status"]) {
      expect(header).toContain(col);
    }
    expect(csv).toContain("supporter");
  });

  it("membership follows ATTACHMENT, not a stale list_member column (FR-011)", async () => {
    // Flagged as a list member by the old rule, but on no account: must NOT appear.
    await makeContactWithEmail({
      firstName: "Historic",
      lastName: "Member",
      email: "historic@example.com",
      listMember: true,
      membershipStatus: "current",
    });
    const csv = await memberCsv();
    expect(csv).not.toContain("historic@example.com");
  });

  it("an attached member appears even though they pay for nothing (FR-011)", async () => {
    const payer = await makeContactWithEmail({
      firstName: "Cindy",
      lastName: "Culbert",
      email: "cindy@example.com",
    });
    const abby = await makeContactWithEmail({
      firstName: "Abigail",
      lastName: "Culbert",
      email: "abby@example.com",
    });
    await recordDuesPayment(
      db,
      payer.contactId,
      { level: "supporter", paymentDate: future() },
      null,
    );
    await attachMember(db, payer.contactId, abby.contactId, null);

    const csv = await memberCsv();
    expect(csv).toContain("abby@example.com");
    // Level is the PAYER'S: Abby pays for nothing, so her level cell is blank (FR-013).
    const abbyRow = csv.split("\n").find((l) => l.includes("abby@example.com"))!;
    expect(abbyRow).not.toMatch(/supporter/);
  });

  it("a LAPSED member is still listed, so the reminder reaches them (FR-012)", async () => {
    // Name and address deliberately avoid the word "lapsed": asserting /lapsed/ against a row containing
    // lapsed@example.com would pass on the email alone, whatever the status column actually said.
    const payer = await makeContactWithEmail({
      firstName: "Former",
      lastName: "Member",
      email: "former@example.com",
    });
    await recordDuesPayment(
      db,
      payer.contactId,
      { level: "individual", paymentDate: longAgo() },
      null,
    );

    const csv = await memberCsv();
    const row = csv.split("\n").find((l) => l.includes("former@example.com"));
    expect(row).toBeTruthy(); // still listed — they are who the reminder is for
    expect(row!.split(",")[3]).toBe("lapsed"); // the STATUS column, not an incidental match
  });

  it("do_not_contact still suppresses a member (FR-014)", async () => {
    const payer = await makeContactWithEmail({
      firstName: "Quiet",
      lastName: "Payer",
      email: "quiet@example.com",
      consentTopics: ["do_not_contact"],
    });
    await recordDuesPayment(
      db,
      payer.contactId,
      { level: "individual", paymentDate: future() },
      null,
    );
    expect(await memberCsv()).not.toContain("quiet@example.com");
  });

  it("a shared address still yields ONE row (feature 067 dedupe survives)", async () => {
    const owner = await makeContactWithEmail({
      firstName: "David",
      lastName: "Jones",
      email: "shared@jones.com",
    });
    const [bridget] = await db.insert(contacts).values(contactRow("Bridget Jones")).returning();
    await linkMessageRecipient(db, bridget!.id, { emailId: owner.emailId }, null);
    await recordDuesPayment(db, owner.contactId, { level: "family", paymentDate: future() }, null);
    await attachMember(db, owner.contactId, bridget!.id, null);

    const csv = await memberCsv();
    const rows = csv.split("\n").filter((l) => l.includes("shared@jones.com"));
    expect(rows).toHaveLength(1);
  });

  it("status is derived, so a stale stored column does not leak into the file (FR-015)", async () => {
    const payer = await makeContactWithEmail({
      firstName: "Stale",
      lastName: "Cache",
      email: "stale@example.com",
    });
    await recordDuesPayment(
      db,
      payer.contactId,
      { level: "individual", paymentDate: longAgo() },
      null,
    );
    await db
      .update(contacts)
      .set({ membershipStatus: "current" })
      .where(eq(contacts.id, payer.contactId));

    const row = (await memberCsv()).split("\n").find((l) => l.includes("stale@example.com"))!;
    expect(row.split(",")[3]).toBe("lapsed"); // derived, not the stored value
    expect(await db.select().from(contactEmails)).not.toHaveLength(0);
  });
});
