import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contacts, membershipAccounts, membershipMembers } from "@/server/db/schema";
import { contactRow, makeMembershipAccount } from "./helpers/factories";
import { mergeContacts } from "@/server/domain/dedup/mergeService";
import { contactMembership } from "@/server/domain/membership/membershipStatus";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

/**
 * Feature 069 (FR-010) — a defect feature 068 left behind.
 *
 * `mergeService` still relinked the `memberships` / `payers` tables that 068 retired, and did nothing
 * with `membership_accounts` / `membership_members`. Merging an account owner would therefore leave that
 * household's account owned by a contact retired via `merged_into_id` — invisible to every read, with the
 * survivor gaining nothing. Latent rather than done (no merge has happened since 068), but the merge
 * worklists this feature builds are precisely what will trigger it.
 */
describe("a merge moves membership accounts and attachments (FR-010)", () => {
  const contact = async (name: string) =>
    (await db.insert(contacts).values(contactRow(name)).returning())[0]!.id;

  it("the merged contact's ACCOUNT moves to the survivor", async () => {
    const actor = await contact("Mel Actor");
    const survivor = await contact("Robert Jones");
    const dupe = await contact("Rob Jones");
    await makeMembershipAccount({
      payerContactId: dupe,
      level: "family",
      expiryDate: "2099-08-31",
    });

    const result = await mergeContacts(db, survivor, dupe, actor);
    if (result.outcome !== "completed") throw new Error("expected completed");
    expect(result.canonicalId).toBe(survivor);
    expect(result.moved.membership_accounts).toBe(1);

    expect(
      await db.query.membershipAccounts.findFirst({
        where: eq(membershipAccounts.payerContactId, survivor),
      }),
    ).toBeDefined();
    // Nothing is left owned by the retired contact.
    expect(
      await db.query.membershipAccounts.findFirst({
        where: eq(membershipAccounts.payerContactId, dupe),
      }),
    ).toBeUndefined();
    // The survivor's derived status reflects what it gained.
    expect((await contactMembership(db, survivor)).isMember).toBe(true);
  });

  it("the merged contact's ATTACHMENT moves, so the survivor keeps the coverage", async () => {
    const actor = await contact("Mel Actor");
    const payer = await contact("Household Payer");
    const survivor = await contact("Chris Jones");
    const dupe = await contact("Cris Jones");
    const { accountId } = await makeMembershipAccount({
      payerContactId: payer,
      level: "family",
      expiryDate: "2099-08-31",
      members: [dupe],
    });

    await mergeContacts(db, survivor, dupe, actor);

    const rows = await db
      .select({ contactId: membershipMembers.contactId })
      .from(membershipMembers)
      .where(eq(membershipMembers.accountId, accountId));
    const ids = rows.map((r) => r.contactId);
    expect(ids).toContain(survivor);
    expect(ids).not.toContain(dupe);
    expect((await contactMembership(db, survivor)).isMember).toBe(true);
  });

  it("does not touch the retired memberships / payers tables", async () => {
    const actor = await contact("Mel Actor");
    const survivor = await contact("Keep Me");
    const dupe = await contact("Drop Me");
    await makeMembershipAccount({ payerContactId: dupe, expiryDate: "2099-08-31" });

    const result = await mergeContacts(db, survivor, dupe, actor);
    if (result.outcome !== "completed") throw new Error("expected completed");
    expect(result.moved).not.toHaveProperty("memberships");
    expect(result.moved).not.toHaveProperty("payers");
  });
});
