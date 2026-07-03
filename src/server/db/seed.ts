import { eq } from "drizzle-orm";
import { db, sql } from "@/server/db/client";
import {
  accountMapping,
  contactEmails,
  contacts,
  doorRecords,
  eventGroups,
  events,
  memberships,
  payers,
  performers,
  series,
  seriesParameters,
  seriesQboMap,
} from "@/server/db/schema";
import { normalizeName } from "@/server/domain/contacts/normalize";
import { recomputeContactStatus } from "@/server/domain/membership/membershipService";
import type { EmailConsentTopic } from "@/server/db/schema";

/**
 * Seed a realistic fixture: ~1,300 contacts and ~152 members. Used for manual
 * validation and to exercise fuzzy-search performance (SC-005). Idempotent-ish:
 * truncates the feature tables first.
 */
const FIRST = ["Ada", "Grace", "Alan", "Katherine", "Dorothy", "Edsger", "Donald", "Barbara", "Tim", "Margaret"];
const LAST = ["Lovelace", "Hopper", "Turing", "Johnson", "Vaughan", "Dijkstra", "Knuth", "Liskov", "Berners-Lee", "Hamilton"];

async function main() {
  await sql`TRUNCATE mailing_list_exports, misc_expenses, series_parameters, series_parameter_audit, door_record_audit, gate_sales, door_records, attendance, quarterly_attendance_counts, events, event_groups, merge_audit, status_change_audit, memberships, payers, contact_emails, contacts RESTART IDENTITY CASCADE`;

  // Series (config) — idempotent.
  await db
    .insert(series)
    .values([
      { key: "tnc", name: "Thursday Night Contra", hasSoundTech: true },
      { key: "ecd", name: "Sunday English Country Dance", hasSoundTech: true },
      { key: "community_dance", name: "Community Dance", hasSoundTech: false },
      { key: "general", name: "General / Joint Events", hasSoundTech: true },
    ])
    .onConflictDoNothing({ target: series.key });

  const total = 1300;
  const ids: string[] = [];
  for (let i = 0; i < total; i += 500) {
    const batch = Array.from({ length: Math.min(500, total - i) }, (_, j) => {
      const n = i + j;
      const name = `${FIRST[n % FIRST.length]} ${LAST[(n * 7) % LAST.length]} ${n}`;
      return { displayName: name, nameNormalized: normalizeName(name) };
    });
    const inserted = await db.insert(contacts).values(batch).returning({ id: contacts.id });
    ids.push(...inserted.map((r) => r.id));
  }

  // Emails for everyone.
  for (let i = 0; i < ids.length; i += 500) {
    const batch = ids.slice(i, i + 500).map((id, k) => ({
      contactId: id,
      email: `contact${i + k}@example.com`,
    }));
    await db.insert(contactEmails).values(batch);
  }

  // ~152 members with future expiry.
  const memberIds = ids.slice(0, 152);
  for (const id of memberIds) {
    const [payer] = await db.insert(payers).values({ name: "Self", contactId: id }).returning();
    await db
      .insert(memberships)
      .values({ contactId: id, payerId: payer!.id, expiryDate: "2030-12-31" });
    await recomputeContactStatus(db, id, "membership_change", "seed");
  }

  // A sample event + door record for manual validation.
  const tnc = await db.query.series.findFirst({ where: eq(series.key, "tnc") });
  if (tnc) {
    const [evt] = await db
      .insert(events)
      .values({ seriesId: tnc.id, eventDate: "2026-06-18", chargesAdmission: true })
      .returning();
    if (evt) await db.insert(doorRecords).values({ eventId: evt.id });
  }

  // Sample contacts for feature 006 (iContact export) manual testing — one per consent topic.
  const topicSamples: { name: string; email: string; topics: EmailConsentTopic[] }[] = [
    { name: "Contra Fan", email: "contra.fan@example.com", topics: ["contra"] },
    { name: "English Fan", email: "english.fan@example.com", topics: ["english"] },
    { name: "Openband Fan", email: "openband.fan@example.com", topics: ["openband"] },
    { name: "Special Events Fan", email: "specialevents.fan@example.com", topics: ["special_events"] },
    { name: "Jane Austen Fan", email: "jab.fan@example.com", topics: ["jane_austen_ball"] },
    { name: "Tracing Willing", email: "tracing.willing@example.com", topics: ["contact_tracing"] },
    { name: "Opted Out", email: "opted.out@example.com", topics: ["do_not_contact"] },
  ];
  for (const s of topicSamples) {
    const [contact] = await db
      .insert(contacts)
      .values({ displayName: s.name, nameNormalized: normalizeName(s.name) })
      .returning();
    if (contact) {
      await db.insert(contactEmails).values({
        contactId: contact.id,
        email: s.email,
        consentTopics: s.topics,
      });
    }
  }

  // Jane Austen Ball event group + event, for the janeaustenball "most recent year" label (FR-005).
  const [jabGroup] = await db
    .insert(eventGroups)
    .values({ name: "Jane Austen Ball 2026", kind: "jane_austen_ball" })
    .returning();
  if (jabGroup && tnc) {
    await db
      .insert(events)
      .values({ seriesId: tnc.id, eventDate: "2026-03-14", chargesAdmission: true, groupId: jabGroup.id });
  }

  // QBO account/class mapping (chart of accounts) + gate customers per series.
  await db
    .insert(accountMapping)
    .values([
      { lineKey: "admission", accountCode: "4210", accountName: "Program Service Revenue:Dance Gate" },
      { lineKey: "merchandise", accountCode: "4700", accountName: "Sales of Inventory" },
      { lineKey: "donation", accountCode: "4100", accountName: "Voluntary Contributions" },
      { lineKey: "future_event", accountCode: "4200", accountName: "Program Service Revenue" },
      { lineKey: "membership", accountCode: "4300", accountName: "Membership Dues" },
      { lineKey: "gift_card", accountCode: "2201", accountName: "Prepaid Services:Pre-paid Gift Card" },
      { lineKey: "misc_sales", accountCode: "4900", accountName: "Uncategorized Income" },
      { lineKey: "caller", accountCode: "5320", accountName: "Program Staff:Callers" },
      { lineKey: "lead_musician", accountCode: "5310", accountName: "Program Staff:Bands" },
      { lineKey: "musician", accountCode: "5310", accountName: "Program Staff:Bands" },
      { lineKey: "sound_tech", accountCode: "5330", accountName: "Program Staff:Sound Tech" },
      { lineKey: "rent", accountCode: "5420", accountName: "Facilities:Rent" },
      { lineKey: "fees", accountCode: "5810", accountName: "Bank Charges & Fees:PayPal Fees" },
      { lineKey: "deposit", accountCode: "1021", accountName: "ESL Checking" },
      { lineKey: "non_dance_income", accountCode: "4910", accountName: "Other Miscellaneous Revenue" },
    ])
    .onConflictDoNothing({ target: accountMapping.lineKey });

  const allSeries = await db.select().from(series);
  for (const srow of allSeries) {
    await db
      .insert(seriesQboMap)
      .values({
        seriesId: srow.id,
        gateCustomer: srow.key === "ecd" ? "English Gate" : "Contra Gate",
        qboClass: srow.key === "tnc" ? "TNC" : srow.key === "ecd" ? "ECD" : "Community Dance",
      })
      .onConflictDoNothing({ target: seriesQboMap.seriesId });
  }

  // Performers.
  await db.insert(performers).values([
    { displayName: "Sample Caller", bio: "Calls contras." },
    { displayName: "Sample Sound Tech" },
  ]);

  // Sample series-scoped rate + expense parameters for every series (feature 009).
  for (const srow of allSeries) {
    await db.insert(seriesParameters).values([
      { category: "rate", seriesId: srow.id, kind: "caller", amountCents: 15000, effectiveDate: "2026-01-01" },
      { category: "rate", seriesId: srow.id, kind: "sound_tech", amountCents: 10000, effectiveDate: "2026-01-01" },
      { category: "rate", seriesId: srow.id, kind: "musician", amountCents: 7500, effectiveDate: "2026-01-01" },
      { category: "expense", seriesId: srow.id, kind: "rent", amountCents: 8000, label: "Hall rent", effectiveDate: "2026-01-01" },
      { category: "expense", seriesId: srow.id, kind: "ongoing", amountCents: 1500, label: "Supplies/insurance", effectiveDate: "2026-01-01" },
    ]);
  }

  console.log(
    `seeded ${ids.length} contacts, ${memberIds.length} members, series + sample event, performers + rates + expense params`,
  );
  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
