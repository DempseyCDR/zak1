import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import { contactEmails } from "@/server/db/schema";
import { withAuth } from "@/server/auth/withAuth";
import { searchContacts } from "@/server/domain/contacts/contactService";

export const GET = withAuth({ requires: "base" }, async (req) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  // Door roster: browse alphabetically by last name (feature 012, FR-007); a query ranks by similarity.
  const matches = await searchContacts(db, q, 20, { orderBy: "name" });
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
  return NextResponse.json({ items });
});
