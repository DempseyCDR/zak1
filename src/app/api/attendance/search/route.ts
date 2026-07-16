import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import { contactEmails } from "@/server/db/schema";
import { withAuth } from "@/server/auth/withAuth";
import { searchContacts } from "@/server/domain/contacts/contactService";
import { canReadPii, recordPiiDisclosure } from "@/server/auth/pii";

export const GET = withAuth({ requires: "base" }, async (req, { actor }) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  // Door roster: browse alphabetically by last name (feature 012, FR-007); a query ranks by similarity.
  const matches = await searchContacts(db, q, 20, { orderBy: "name" });

  // FR-016/FR-017 — "matching a dancer": this lookup shows a match's PII to a holder (the Door
  // Attendant needs it to pick the right John Smith), and returns names-only to everyone else. The
  // checked-in ROSTER (a different endpoint) is names-only for all, by construction.
  if (!canReadPii(actor)) {
    return NextResponse.json({ items: matches.map((m) => ({ ...m, emails: [] })) });
  }

  const ids = matches.map((m) => m.id);
  const emails = ids.length
    ? await db
        .select({ contactId: contactEmails.contactId, email: contactEmails.email })
        .from(contactEmails)
        .where(inArray(contactEmails.contactId, ids))
    : [];
  const byContact = new Map<string, string[]>();
  for (const e of emails) {
    const list = byContact.get(e.contactId) ?? [];
    list.push(e.email);
    byContact.set(e.contactId, list);
  }
  const items = matches.map((m) => ({ ...m, emails: byContact.get(m.id) ?? [] }));
  // One row per request, counting contacts whose PII was disclosed (FR-017b) — never one per contact.
  await recordPiiDisclosure(db, actor, "attendance.search", byContact.size);
  return NextResponse.json({ items });
});
