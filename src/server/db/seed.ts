import { eq } from "drizzle-orm";
import { db, sql } from "@/server/db/client";
import {
  contactEmails,
  contacts,
  doorRecords,
  events,
  memberships,
  payers,
  performers,
  rateParameters,
  series,
} from "@/server/db/schema";
import { normalizeName } from "@/server/domain/contacts/normalize";
import { recomputeContactStatus } from "@/server/domain/membership/membershipService";

/**
 * Seed a realistic fixture: ~1,300 contacts and ~152 members. Used for manual
 * validation and to exercise fuzzy-search performance (SC-005). Idempotent-ish:
 * truncates the feature tables first.
 */
const FIRST = ["Ada", "Grace", "Alan", "Katherine", "Dorothy", "Edsger", "Donald", "Barbara", "Tim", "Margaret"];
const LAST = ["Lovelace", "Hopper", "Turing", "Johnson", "Vaughan", "Dijkstra", "Knuth", "Liskov", "Berners-Lee", "Hamilton"];

async function main() {
  await sql`TRUNCATE door_record_audit, gate_sales, door_records, attendance, quarterly_attendance_counts, events, event_groups, merge_audit, status_change_audit, memberships, payers, contact_emails, contacts RESTART IDENTITY CASCADE`;

  // Series (config) — idempotent.
  await db
    .insert(series)
    .values([
      { key: "tnc", name: "Thursday Night Contra", hasSoundTech: true },
      { key: "ecd", name: "Sunday English Country Dance", hasSoundTech: true },
      { key: "community_dance", name: "Community Dance", hasSoundTech: false },
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

  // Performers + standard rates.
  await db.insert(performers).values([
    { displayName: "Sample Caller", bio: "Calls contras." },
    { displayName: "Sample Sound Tech" },
  ]);
  await db.insert(rateParameters).values([
    { kind: "caller", amountCents: 15000, effectiveDate: "2026-01-01" },
    { kind: "sound_tech", amountCents: 10000, effectiveDate: "2026-01-01" },
  ]);

  console.log(
    `seeded ${ids.length} contacts, ${memberIds.length} members, series + sample event, performers + rates`,
  );
  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
