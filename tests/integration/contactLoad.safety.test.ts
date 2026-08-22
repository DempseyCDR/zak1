import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { icontactCsv, memberCsv, payerCsv } from "./helpers/contactLoadCsv";
import { auditEvents, contactEmails, contacts } from "@/server/db/schema";
import { deriveContactNames } from "@/server/domain/contacts/normalize";
import { parseIcontact } from "@/server/domain/contactLoad/parseIcontact";
import { parseMemberSheet } from "@/server/domain/contactLoad/parseMemberSheet";
import { parsePayerSheet } from "@/server/domain/contactLoad/parsePayerSheet";
import { executeContactLoad } from "@/server/domain/contactLoad/execute";
import type { MemberRowFixture } from "./helpers/contactLoadCsv";

function run(members: MemberRowFixture[], opts: { dryRun: boolean }) {
  return executeContactLoad(
    db,
    {
      icontact: parseIcontact(icontactCsv([])),
      members: parseMemberSheet(memberCsv(members)),
      payers: parsePayerSheet(payerCsv([])),
    },
    opts,
  );
}
async function contactCount() {
  return (await db.select().from(contacts)).length;
}
async function insertContact(firstName: string, lastName?: string) {
  const names = deriveContactNames({ firstName, lastName });
  const [c] = await db
    .insert(contacts)
    .values({
      firstName,
      lastName: lastName ?? null,
      displayName: names.displayName,
      nameNormalized: names.nameNormalized,
      dedupNormalized: names.dedupNormalized,
      membershipStatus: "never",
    })
    .returning();
  return c!;
}

describe("contact load — safe, previewable, atomic execution (US5)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("dry-run computes counts but writes nothing (no contact, no audit row)", async () => {
    const before = await contactCount();
    const { counts } = await run([{ first: "Dry", last: "Run", email: "dry@x.com" }], {
      dryRun: true,
    });
    expect(counts.contactsCreated).toBe(1); // would-be
    expect(await contactCount()).toBe(before); // nothing persisted
    const [email] = await db
      .select()
      .from(contactEmails)
      .where(eq(contactEmails.email, "dry@x.com"));
    expect(email).toBeUndefined();
    const audits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.kind, "contact.bulk_load"));
    expect(audits).toHaveLength(0);
  });

  it("rolls back completely on a mid-run failure (all-or-nothing)", async () => {
    const victim = await insertContact("Victim", "Contact"); // non-role → would be deleted
    // Two different people sharing one email violates the active-email unique index mid-transaction.
    await expect(
      run(
        [
          { first: "Aaa", last: "One", email: "dup@x.com" },
          { first: "Bbb", last: "Two", email: "dup@x.com" },
        ],
        { dryRun: false },
      ),
    ).rejects.toThrow();

    // Delete of the victim rolled back; no partial roster remains.
    const [stillThere] = await db.select().from(contacts).where(eq(contacts.id, victim.id));
    expect(stillThere).toBeDefined();
    const [dup] = await db.select().from(contactEmails).where(eq(contactEmails.email, "dup@x.com"));
    expect(dup).toBeUndefined();
  });

  it("writes exactly one durable audit row on a successful commit", async () => {
    await run([{ first: "Real", last: "Commit", email: "real@x.com" }], { dryRun: false });
    const audits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.kind, "contact.bulk_load"));
    expect(audits).toHaveLength(1);
    expect(audits[0]!.actorContactId).toBeNull();
  });
});
