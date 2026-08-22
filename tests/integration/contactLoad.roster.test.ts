import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import { icontactCsv, memberCsv, payerCsv } from "./helpers/contactLoadCsv";
import { auditEvents, contactEmails, contacts, mergeAudit, roleGrants } from "@/server/db/schema";
import { deriveContactNames } from "@/server/domain/contacts/normalize";
import { parseIcontact } from "@/server/domain/contactLoad/parseIcontact";
import { parseMemberSheet } from "@/server/domain/contactLoad/parseMemberSheet";
import { parsePayerSheet } from "@/server/domain/contactLoad/parsePayerSheet";
import { executeContactLoad } from "@/server/domain/contactLoad/execute";
import type { IcRow, MemberRowFixture, PayerRowFixture } from "./helpers/contactLoadCsv";

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

function run(
  fx: { icontact?: IcRow[]; members?: MemberRowFixture[]; payers?: PayerRowFixture[] },
  opts: { dryRun?: boolean } = {},
) {
  return executeContactLoad(
    db,
    {
      icontact: parseIcontact(icontactCsv(fx.icontact ?? [])),
      members: parseMemberSheet(memberCsv(fx.members ?? [])),
      payers: parsePayerSheet(payerCsv(fx.payers ?? [])),
    },
    { dryRun: opts.dryRun ?? false },
  );
}

async function byEmail(email: string) {
  const [row] = await db.select().from(contactEmails).where(eq(contactEmails.email, email));
  return row ?? null;
}
async function contactById(id: string) {
  const [row] = await db.select().from(contacts).where(eq(contacts.id, id));
  return row ?? null;
}

describe("contact load — roster rebuild & retention (US1)", () => {
  beforeAll(ensureSchema);
  beforeEach(resetDb);
  afterAll(closeDb);

  it("keeps role-holders, removes non-role contacts, and rebuilds the union", async () => {
    const staff = await db.query.contacts.findFirst(); // seeded super_user, retained
    const oldDancer = await insertContact("Old", "Dancer");

    const { counts } = await run({
      members: [{ first: "New", last: "Person", email: "new@x.com" }],
      icontact: [{ email: "sub@x.com", fname: "Only", lname: "Subscriber", contra: "1" }],
    });

    expect(await contactById(staff!.id)).not.toBeNull(); // role-holder survives
    expect(await contactById(oldDancer.id)).toBeNull(); // non-role removed
    expect(await byEmail("new@x.com")).not.toBeNull();
    expect(await byEmail("sub@x.com")).not.toBeNull();
    expect(counts.contactsCreated).toBe(2);
    expect(counts.removed).toBe(1);
    expect(counts.retained).toBe(1);
  });

  it("nulls RESTRICT audit/grant refs and retains merge parties instead of failing the delete", async () => {
    const actorGone = await insertContact("Actor", "Gone");
    await db.insert(auditEvents).values({ kind: "pii.disclosed", actorContactId: actorGone.id });

    const granterGone = await insertContact("Granter", "Gone");
    const staff = await db.query.contacts.findFirst();
    await db
      .insert(roleGrants)
      .values({ contactId: staff!.id, role: "booker", grantedBy: granterGone.id });

    const mergeCanon = await insertContact("Merge", "Canon");
    const mergeGone = await insertContact("Merge", "Goneaway");
    await db
      .insert(mergeAudit)
      .values({ canonicalId: mergeCanon.id, mergedId: mergeGone.id, actor: "op" });

    // Must not throw on the RESTRICT FKs.
    const { counts } = await run({ members: [{ first: "Fresh", last: "Face", email: "f@x.com" }] });

    expect(await contactById(actorGone.id)).toBeNull(); // deleted...
    const [ev] = await db.select().from(auditEvents).where(eq(auditEvents.kind, "pii.disclosed"));
    expect(ev!.actorContactId).toBeNull(); // ...with its audit actor nulled

    expect(await contactById(granterGone.id)).toBeNull(); // deleted...
    const [g] = await db.select().from(roleGrants).where(eq(roleGrants.role, "booker"));
    expect(g!.grantedBy).toBeNull(); // ...with the surviving grant's granted_by nulled

    expect(await contactById(mergeCanon.id)).not.toBeNull(); // merge parties retained
    expect(await contactById(mergeGone.id)).not.toBeNull();
    expect(counts.retained).toBe(3); // staff + 2 merge parties
  });

  it("lets the Member sheet win identity and folds the iContact email/consent onto one contact", async () => {
    await run({
      members: [
        {
          first: "Jane",
          last: "Knoeck",
          pronouns: "She/Her",
          volunteer: true,
          email: "jane@x.com",
        },
      ],
      icontact: [{ email: "jane@x.com", fname: "J", lname: "Knoeck", contra: "1" }],
    });
    const email = await byEmail("jane@x.com");
    const c = await contactById(email!.contactId);
    expect(c!.firstName).toBe("Jane");
    expect(c!.pronouns).toBe("She/Her");
    expect(c!.isVolunteer).toBe(true);
    expect(email!.consentTopics.sort()).toEqual(["contact_tracing", "contra"]);
    // exactly one contact for that person
    const all = await db.select().from(contactEmails).where(eq(contactEmails.email, "jane@x.com"));
    expect(all).toHaveLength(1);
  });

  it("merges two iContact rows for one person into one contact with two emails", async () => {
    await run({
      icontact: [
        { email: "sam@x.com", fname: "Sam", lname: "Reed", contra: "1" },
        { email: "sam2@x.com", fname: "Sam", lname: "Reed", english: "1" },
      ],
    });
    const e1 = await byEmail("sam@x.com");
    const e2 = await byEmail("sam2@x.com");
    expect(e1!.contactId).toBe(e2!.contactId);
  });

  it("flags nameless and combined rows for review", async () => {
    await run({
      icontact: [
        { email: "brooks@x.com", contra: "1" },
        { email: "hilary@x.com", fname: "Hilary & Ed", lname: "Gutman", contra: "1" },
      ],
    });
    const brooks = await contactById((await byEmail("brooks@x.com"))!.contactId);
    const combined = await contactById((await byEmail("hilary@x.com"))!.contactId);
    expect(brooks!.needsReview).toBe(true);
    expect(combined!.needsReview).toBe(true);
  });

  it("updates a retained role-holder in place when it reappears in the files (no duplicate)", async () => {
    const staff = await db.query.contacts.findFirst();
    const { counts } = await run({
      members: [
        {
          first: "Zztest",
          last: "Staff",
          pronouns: "They/Them",
          email: "zztest.staff@cdrochester.org",
        },
      ],
    });
    const rows = await db
      .select()
      .from(contactEmails)
      .where(eq(contactEmails.email, "zztest.staff@cdrochester.org"));
    expect(rows).toHaveLength(1); // not duplicated
    const c = await contactById(staff!.id);
    expect(c!.pronouns).toBe("They/Them"); // updated in place
    const grants = await db.select().from(roleGrants).where(eq(roleGrants.contactId, staff!.id));
    expect(grants.some((g) => g.role === "super_user")).toBe(true); // grant intact
    expect(counts.contactsUpdated).toBeGreaterThanOrEqual(1);
  });
});
