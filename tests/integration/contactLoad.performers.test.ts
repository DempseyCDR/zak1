import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { icontactCsv, memberCsv, payerCsv } from "./helpers/contactLoadCsv";
import { contacts, performers, roleGrants } from "@/server/db/schema";
import { deriveContactNames } from "@/server/domain/contacts/normalize";
import { parseIcontact } from "@/server/domain/contactLoad/parseIcontact";
import { parseMemberSheet } from "@/server/domain/contactLoad/parseMemberSheet";
import { parsePayerSheet } from "@/server/domain/contactLoad/parsePayerSheet";
import { executeContactLoad } from "@/server/domain/contactLoad/execute";
import type { MemberRowFixture } from "./helpers/contactLoadCsv";

function run(members: MemberRowFixture[]) {
  return executeContactLoad(
    db,
    {
      icontact: parseIcontact(icontactCsv([])),
      members: parseMemberSheet(memberCsv(members)),
      payers: parsePayerSheet(payerCsv([])),
    },
    { dryRun: false },
  );
}
async function insertRetainedContact(firstName: string, lastName: string) {
  const names = deriveContactNames({ firstName, lastName });
  const [c] = await db
    .insert(contacts)
    .values({
      firstName,
      lastName,
      displayName: names.displayName,
      nameNormalized: names.nameNormalized,
      dedupNormalized: names.dedupNormalized,
      membershipStatus: "never",
    })
    .returning();
  // give it a role so the load retains it
  await db.insert(roleGrants).values({ contactId: c!.id, role: "booker" });
  return c!;
}
async function performerById(id: string) {
  const [p] = await db.select().from(performers).where(eq(performers.id, id));
  return p!;
}

describe("contact load — performer link proposals (US4)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("auto-links an exact single match, and surfaces ambiguous/unmatched without linking", async () => {
    // Ambiguity: two RETAINED contacts share a name → any performer matching it is ambiguous.
    await insertRetainedContact("Jamie", "Fiddle");
    await insertRetainedContact("Jamie", "Fiddle");

    const [solo] = await db.insert(performers).values({ displayName: "Solo Caller" }).returning();
    const [ambiguous] = await db
      .insert(performers)
      .values({ displayName: "Jamie Fiddle" })
      .returning();
    const [ghost] = await db.insert(performers).values({ displayName: "Ghost Player" }).returning();

    const { counts } = await run([{ first: "Solo", last: "Caller", email: "solo@x.com" }]);

    // exact single → auto-linked
    const soloAfter = await performerById(solo!.id);
    expect(soloAfter.contactId).not.toBeNull();
    // several → surfaced, not linked
    expect((await performerById(ambiguous!.id)).contactId).toBeNull();
    // none → surfaced, not linked
    expect((await performerById(ghost!.id)).contactId).toBeNull();

    expect(counts.performerAuto).toBe(1);
    expect(counts.performerAmbiguous).toBe(1);
    expect(counts.performerUnmatched).toBe(1);
  });
});
