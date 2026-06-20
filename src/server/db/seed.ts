import { db, sql } from "@/server/db/client";
import { contactEmails, contacts, memberships, payers } from "@/server/db/schema";
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
  await sql`TRUNCATE merge_audit, status_change_audit, memberships, payers, contact_emails, contacts RESTART IDENTITY CASCADE`;

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

  console.log(`seeded ${ids.length} contacts, ${memberIds.length} members`);
  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
