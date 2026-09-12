import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { ensureSchema, resetDb, closeDb, db } from "./helpers/db";
import {
  attendance,
  contactEmails,
  contacts,
  membershipMembers,
  mergeAudit,
  officers,
  performers,
  roleGrants,
  staffIdentities,
} from "@/server/db/schema";
import {
  contactRow,
  makeContactWithEmail,
  makeEvent,
  makeMembershipAccount,
} from "./helpers/factories";
import { mergeContacts } from "@/server/domain/dedup/mergeService";
import { parseManifest, type ManifestEntry } from "@/server/domain/dedup/mergeManifest";

beforeAll(ensureSchema);
beforeEach(resetDb);
afterAll(closeDb);

const contact = async (name: string) =>
  (await db.insert(contacts).values(contactRow(name)).returning())[0]!.id;

/** The manifest as the merge actually stored it — read back through the Zod parser, never raw. */
async function manifestFor(mergedId: string): Promise<ManifestEntry[]> {
  const row = await db.query.mergeAudit.findFirst({ where: eq(mergeAudit.mergedId, mergedId) });
  if (!row) throw new Error("no merge_audit row");
  const manifest = parseManifest(row.reversalManifest);
  if (!manifest) throw new Error("merge recorded no manifest");
  return manifest.entries;
}

const entriesFor = (entries: ManifestEntry[], table: string, kind?: ManifestEntry["kind"]) =>
  entries.filter((e) => e.table === table && (kind === undefined || e.kind === kind));

/**
 * Feature 074 (FR-001 to FR-005). What a merge writes down about itself.
 *
 * Contents are asserted, not counts. A manifest with the right shape and the wrong key would satisfy
 * every count and then fail to restore anything — weeks later, when somebody needed it. So each test
 * checks that the recorded key actually names the row that moved.
 */
describe("a merge records every row it re-links (FR-001)", () => {
  it("records a move per relinked row, naming the row and where it came from", async () => {
    const survivor = await contact("Keep Me");
    const dupe = await contact("Drop Me");
    const event = await makeEvent();

    const [perf] = await db
      .insert(performers)
      .values({ displayName: "Drop Me", contactId: dupe })
      .returning();
    const [att] = await db
      .insert(attendance)
      .values({ eventId: event.id, contactId: dupe })
      .returning();
    const [officer] = await db
      .insert(officers)
      .values({ roleKey: "secretary", contactId: dupe })
      .returning();

    const result = await mergeContacts(db, survivor, dupe, survivor);
    if (result.outcome !== "completed") throw new Error("expected completed");

    const entries = await manifestFor(dupe);

    for (const [table, row] of [
      ["performers", perf!],
      ["attendance", att!],
      ["officers", officer!],
    ] as const) {
      const [entry] = entriesFor(entries, table, "move");
      expect(entry, `no move entry recorded for ${table}`).toBeDefined();
      if (entry?.kind !== "move") throw new Error("expected move");
      // The key must name the row that actually moved, by the database's own column name.
      expect(entry.key).toEqual({ id: row.id });
      expect(entry.column).toBe("contact_id");
      // And where to put it back.
      expect(entry.fromContactId).toBe(dupe);
    }
  });

  it("records membership_members by its COMPOSITE key, as it stands after the move", async () => {
    const survivor = await contact("Keep Me");
    const dupe = await contact("Drop Me");
    const { accountId } = await makeMembershipAccount({
      payerContactId: survivor,
      expiryDate: "2027-01-01",
      members: [dupe],
    });

    const result = await mergeContacts(db, survivor, dupe, survivor);
    if (result.outcome !== "completed") throw new Error("expected completed");

    // dupe was already on the survivor's account, so its row collides and is DROPPED, not moved.
    // What matters here is that whichever happens is recorded by the pair, never by a non-existent `id`.
    const entries = await manifestFor(dupe);
    const memberEntries = entriesFor(entries, "membership_members");
    expect(memberEntries.length, "the household row was not recorded at all").toBeGreaterThan(0);
    for (const entry of memberEntries) {
      expect(Object.keys(entry.key).sort()).toEqual(["account_id", "contact_id"]);
      expect(entry.key.account_id).toBe(accountId);
    }
  });

  it("records a moved sign-in as access-changing", async () => {
    const survivor = await contact("Keep Me");
    const { contactId: dupe } = await makeContactWithEmail({
      displayName: "Drop Me",
      email: "drop@example.com",
    });
    const [identity] = await db
      .insert(staffIdentities)
      .values({ contactId: dupe, googleSub: "sub-drop" })
      .returning();

    const result = await mergeContacts(db, survivor, dupe, survivor);
    if (result.outcome !== "completed") throw new Error("expected completed");

    const [entry] = entriesFor(await manifestFor(dupe), "staff_identities", "move");
    expect(entry, "the moved sign-in was not recorded").toBeDefined();
    expect(entry?.key).toEqual({ id: identity!.id });
    // The gate in FR-024 keys off this flag; without it the undo would silently grant access.
    expect(entry?.accessChanging).toBe(true);
  });

  it("records moved role grants", async () => {
    const survivor = await contact("Keep Me");
    const dupe = await contact("Drop Me");
    const [grant] = await db
      .insert(roleGrants)
      .values({ contactId: dupe, role: "booker", grantedBy: survivor })
      .returning();

    const result = await mergeContacts(db, survivor, dupe, survivor);
    if (result.outcome !== "completed") throw new Error("expected completed");

    const [entry] = entriesFor(await manifestFor(dupe), "role_grants", "move");
    expect(entry?.key).toEqual({ id: grant!.id });
    if (entry?.kind !== "move") throw new Error("expected move");
    expect(entry.fromContactId).toBe(dupe);
  });
});

describe("a merge records every row it destroys (FR-002)", () => {
  it("snapshots the duplicate attendance row it drops on collision", async () => {
    const survivor = await contact("Keep Me");
    const dupe = await contact("Drop Me");
    const event = await makeEvent();
    // Both records checked in to one event: the merge drops the duplicate.
    await db.insert(attendance).values({ eventId: event.id, contactId: survivor });
    const [dropped] = await db
      .insert(attendance)
      .values({ eventId: event.id, contactId: dupe })
      .returning();

    const result = await mergeContacts(db, survivor, dupe, survivor);
    if (result.outcome !== "completed") throw new Error("expected completed");

    const [entry] = entriesFor(await manifestFor(dupe), "attendance", "destroy");
    expect(entry, "the dropped attendance row left no trace").toBeDefined();
    if (entry?.kind !== "destroy") throw new Error("expected destroy");
    // The whole row, not just its key — an undo has to recreate it as it was.
    expect(entry.row.id).toBe(dropped!.id);
    expect(entry.row.event_id).toBe(event.id);
    expect(entry.row.contact_id).toBe(dupe);
  });

  it("snapshots the duplicate household row it drops on collision", async () => {
    const survivor = await contact("Keep Me");
    const dupe = await contact("Drop Me");
    await makeMembershipAccount({
      payerContactId: survivor,
      expiryDate: "2027-01-01",
      members: [dupe],
    });

    const result = await mergeContacts(db, survivor, dupe, survivor);
    if (result.outcome !== "completed") throw new Error("expected completed");

    const [entry] = entriesFor(await manifestFor(dupe), "membership_members", "destroy");
    expect(entry, "the dropped household row left no trace").toBeDefined();
    if (entry?.kind !== "destroy") throw new Error("expected destroy");
    expect(entry.row.contact_id).toBe(dupe);
    expect(entry.row.attached_at, "attached_at must survive, or the undo invents one").toBeTruthy();
  });

  it("snapshots the discarded account, its household, AND the rows lost to the cascade", async () => {
    // The case with no statement of its own in the merge. `membership_members.account_id` is
    // ON DELETE CASCADE, so deleting the discarded account takes its household rows with it —
    // including the ones ON CONFLICT DO NOTHING never copied because that person was already on the
    // surviving account.
    const survivor = await contact("Keep Me");
    const dupe = await contact("Drop Me");
    const shared = await contact("On Both Accounts");
    const onlyOnDiscarded = await contact("Only Here");

    await makeMembershipAccount({
      payerContactId: survivor,
      level: "individual",
      expiryDate: "2027-01-01",
      members: [shared],
    });
    const { accountId: discarded } = await makeMembershipAccount({
      payerContactId: dupe,
      level: "family",
      expiryDate: "2028-06-30",
      members: [shared, onlyOnDiscarded],
    });

    // Two payers → a two_accounts hold. Resolve it keeping the survivor's account.
    const held = await mergeContacts(db, survivor, dupe, survivor);
    if (held.outcome !== "held" || held.reason !== "two_accounts") {
      throw new Error("expected a two_accounts hold");
    }
    const keep = held.candidates.find((c) => c.payerDisplayName === "Keep Me")!.accountId;
    const result = await mergeContacts(db, survivor, dupe, survivor, {
      survivingAccountId: keep,
    });
    if (result.outcome !== "completed") throw new Error("expected completed");

    const entries = await manifestFor(dupe);

    // The account itself, with the attributes that die with it.
    const [accountEntry] = entriesFor(entries, "membership_accounts", "destroy");
    expect(accountEntry, "the discarded account left no trace").toBeDefined();
    if (accountEntry?.kind !== "destroy") throw new Error("expected destroy");
    expect(accountEntry.row.id).toBe(discarded);
    expect(accountEntry.row.level).toBe("family");
    expect(accountEntry.row.expiry_date).toBe("2028-06-30");

    // Every household row that was on the discarded account, however it came to disappear.
    const lost = entriesFor(entries, "membership_members", "destroy").map((e) =>
      e.kind === "destroy" ? String(e.row.contact_id) : "",
    );
    for (const who of [dupe, shared, onlyOnDiscarded]) {
      expect(lost, `household row for ${who} was destroyed without being recorded`).toContain(who);
    }

    // And the rows the merge CREATED on the surviving account, so an undo can take them away again.
    const created = entriesFor(entries, "membership_members", "create");
    expect(created.length, "rows copied onto the surviving account were not recorded").toBeGreaterThan(
      0,
    );
    for (const entry of created) {
      expect(entry.key.account_id).toBe(keep);
    }
  });

  it("snapshots the discarded sign-in and the demoted login address", async () => {
    const { contactId: survivor, emailId: survivorEmail } = await makeContactWithEmail({
      displayName: "Keep Me",
      email: "keep@example.com",
    });
    const { contactId: dupe, emailId: dupeEmail } = await makeContactWithEmail({
      displayName: "Drop Me",
      email: "drop@example.com",
    });
    await db
      .update(contactEmails)
      .set({ isLogin: true })
      .where(sql`${contactEmails.id} IN (${survivorEmail}, ${dupeEmail})`);
    const [survivorIdentity] = await db
      .insert(staffIdentities)
      .values({ contactId: survivor, googleSub: "sub-keep" })
      .returning();
    await db.insert(staffIdentities).values({ contactId: dupe, googleSub: "sub-drop" });

    const held = await mergeContacts(db, survivor, dupe, survivor);
    if (held.outcome !== "held" || held.reason !== "two_logins") {
      throw new Error("expected a two_logins hold");
    }
    const result = await mergeContacts(db, survivor, dupe, survivor, {
      survivingIdentityId: survivorIdentity!.id,
      survivingLoginEmailId: survivorEmail,
    });
    if (result.outcome !== "completed") throw new Error("expected completed");

    const entries = await manifestFor(dupe);

    // The deleted binding, in full: google_sub is the only durable handle on that Google account.
    const [identityEntry] = entriesFor(entries, "staff_identities", "destroy");
    expect(identityEntry, "the deleted sign-in left no trace").toBeDefined();
    if (identityEntry?.kind !== "destroy") throw new Error("expected destroy");
    expect(identityEntry.row.google_sub).toBe("sub-drop");
    expect(identityEntry.row.contact_id).toBe(dupe);
    expect(identityEntry.accessChanging).toBe(true);

    // And the label that followed it.
    const overwrite = entriesFor(entries, "contact_emails", "overwrite").find(
      (e) => e.key.id === dupeEmail,
    );
    expect(overwrite, "the demoted login address was not recorded").toBeDefined();
    if (overwrite?.kind !== "overwrite") throw new Error("expected overwrite");
    expect(overwrite.column).toBe("is_login");
    expect(overwrite.previousValue).toBe(true);
    expect(overwrite.accessChanging).toBe(true);
  });
});

describe("the manifest is written with the merge, or not at all (FR-005)", () => {
  it("stores a parseable, versioned manifest on every completed merge", async () => {
    const survivor = await contact("Keep Me");
    const dupe = await contact("Drop Me");
    await db.insert(performers).values({ displayName: "Drop Me", contactId: dupe });

    const result = await mergeContacts(db, survivor, dupe, survivor);
    if (result.outcome !== "completed") throw new Error("expected completed");

    const row = await db.query.mergeAudit.findFirst({ where: eq(mergeAudit.mergedId, dupe) });
    // Same row as the merge record: one insert, inside the merge's transaction. A merge that committed
    // without its manifest would be an un-reversible merge nobody could identify as one.
    const manifest = parseManifest(row!.reversalManifest);
    expect(manifest?.version).toBe(1);
    expect(manifest!.entries.length).toBeGreaterThan(0);
  });

  it("writes nothing at all when the merge is HELD", async () => {
    // FR-016 from feature 072: a hold writes only its own row. The manifest must not weaken that.
    const survivor = await contact("Keep Me");
    const dupe = await contact("Drop Me");
    await makeMembershipAccount({ payerContactId: survivor, expiryDate: "2027-01-01" });
    await makeMembershipAccount({ payerContactId: dupe, expiryDate: "2028-01-01" });

    const held = await mergeContacts(db, survivor, dupe, survivor);
    expect(held.outcome).toBe("held");
    expect(await db.select().from(mergeAudit)).toHaveLength(0);
  });

  it("leaves membership_members rows that did not move unrecorded", async () => {
    // A guard against over-recording: a manifest claiming a row moved when it did not would make the
    // undo move somebody else's row away from the survivor.
    const survivor = await contact("Keep Me");
    const dupe = await contact("Drop Me");
    const other = await contact("Unrelated");
    const { accountId } = await makeMembershipAccount({
      payerContactId: other,
      expiryDate: "2027-01-01",
      members: [dupe],
    });

    const result = await mergeContacts(db, survivor, dupe, survivor);
    if (result.outcome !== "completed") throw new Error("expected completed");

    const entries = entriesFor(await manifestFor(dupe), "membership_members");
    // Only dupe's own row on that account moved; `other`'s row is untouched and unrecorded.
    expect(entries).toHaveLength(1);
    expect(entries[0]!.key).toEqual({ account_id: accountId, contact_id: survivor });
    const rows = await db
      .select({ contactId: membershipMembers.contactId })
      .from(membershipMembers)
      .where(eq(membershipMembers.accountId, accountId));
    expect(rows.map((r) => r.contactId).sort()).toEqual([other, survivor].sort());
  });
});
