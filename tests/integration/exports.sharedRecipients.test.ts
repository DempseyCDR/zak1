import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { contactEmails, contacts, performers } from "@/server/db/schema";
import { contactRow, makeContactWithEmail, makeMembershipAccount } from "./helpers/factories";
import { buildListRows } from "@/server/domain/exports/exportService";
import { linkMessageRecipient } from "@/server/domain/contacts/referenceService";
import { attachMember } from "@/server/domain/membership/accountService";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

/**
 * Feature 067 (US2 / FR-010, FR-010a, FR-010b): every export resolves a reference to the owner's
 * address, dedupes by resolved address, and emits ONE row under the OWNER'S name — so the provider file
 * format never changes and a household is reached exactly once.
 */
describe("mailing-list exports resolve shared references (feature 067)", () => {
  /** David owns the household address; Bridget rides it and has none of her own. */
  async function household(opts: { ownerListMember?: boolean; referrerListMember?: boolean } = {}) {
    const owner = await makeContactWithEmail({
      firstName: "David",
      lastName: "Jones",
      email: "shared@jones.com",
      consentTopics: ["contra"],
    });
    const [bridget] = await db.insert(contacts).values(contactRow("Bridget Jones")).returning();
    await linkMessageRecipient(db, bridget!.id, { emailId: owner.emailId }, null);
    // Feature 068: member-list qualification now comes from an ACCOUNT, not `list_member`.
    if (opts.ownerListMember) {
      await makeMembershipAccount({
        payerContactId: owner.contactId,
        level: "family", // must admit Bridget when she qualifies too (FR-003a)
        expiryDate: "2099-08-31",
      });
    }
    if (opts.referrerListMember) {
      if (opts.ownerListMember) {
        await attachMember(db, owner.contactId, bridget!.id, null);
      } else {
        await makeMembershipAccount({
          payerContactId: bridget!.id,
          expiryDate: "2099-08-31",
        });
      }
    }
    return { ownerId: owner.contactId, emailId: owner.emailId, referrerId: bridget!.id };
  }

  it("a referrer's OWN qualification pulls the resolved address in (FR-010a)", async () => {
    // Bridget is the member; David is not. The household address must still reach her.
    await household({ ownerListMember: false, referrerListMember: true });
    const rows = await buildListRows(db, "member");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.email).toBe("shared@jones.com");
    // The row carries the OWNER'S name — the file format is unchanged (clarify answer 4).
    expect(rows[0]!.first_name).toBe("David");
    expect(rows[0]!.last_name).toBe("Jones");
    expect(Object.keys(rows[0]!).sort()).toEqual(
      [
        "email",
        "first_name",
        "last_name",
        "membership_status",
        "membership_through_year",
        "membership_level", // feature 068 (FR-013)
      ].sort(),
    );
  });

  it("dedupes to one row when BOTH parties qualify (FR-010, SC-002)", async () => {
    await household({ ownerListMember: true, referrerListMember: true });
    const rows = await buildListRows(db, "member");
    expect(rows.filter((r) => r.email === "shared@jones.com")).toHaveLength(1);
  });

  it("the owner's do_not_contact suppresses the address absolutely (FR-010b)", async () => {
    const { emailId } = await household({ referrerListMember: true });
    await db
      .update(contactEmails)
      .set({ consentTopics: ["do_not_contact"] })
      .where(eq(contactEmails.id, emailId));
    const rows = await buildListRows(db, "member");
    expect(rows.some((r) => r.email === "shared@jones.com")).toBe(false);
  });

  it("a topic list is unchanged — a referrer holds no consent topics (FR-010a)", async () => {
    await household();
    // The address qualifies on the OWNER's consent alone, and appears exactly once.
    const rows = await buildListRows(db, "contra");
    expect(rows.filter((r) => r.email === "shared@jones.com")).toHaveLength(1);
    expect(rows[0]!.first_name).toBe("David");
    // Nothing the referrer does can put an address on a topic list.
    const english = await buildListRows(db, "english");
    expect(english.some((r) => r.email === "shared@jones.com")).toBe(false);
  });

  it("a referring performer pulls the resolved address onto the performer list (FR-010a)", async () => {
    const { referrerId } = await household();
    await db.insert(performers).values({ displayName: "Bridget Jones", contactId: referrerId });
    const rows = await buildListRows(db, "performer");
    expect(rows.filter((r) => r.email === "shared@jones.com")).toHaveLength(1);
    expect(rows[0]!.first_name).toBe("David");
  });

  it("a contact with neither an owned nor a referenced address contributes no row (FR-010)", async () => {
    await db
      .insert(contacts)
      .values({ ...contactRow("No Address"), listMember: true, membershipStatus: "current" });
    const rows = await buildListRows(db, "member");
    expect(rows).toEqual([]);
  });
});
