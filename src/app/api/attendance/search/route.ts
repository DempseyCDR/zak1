import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import { contactEmails } from "@/server/db/schema";
import { withLogging } from "@/server/lib/withLogging";
import { searchContacts } from "@/server/domain/contacts/contactService";

export const GET = withLogging(async (req) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const matches = await searchContacts(db, q);
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
