import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { contactCreateSchema } from "@/server/validation/contacts";
import { createContact, searchContacts } from "@/server/domain/contacts/contactService";

export const GET = withAuth({ requires: "base" }, async (req) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const items = await searchContacts(db, q);
  return NextResponse.json({ items, total: items.length });
});

export const POST = withAuth({ requires: "contact.write" }, async (req) => {
  const input = await parseBody(req, contactCreateSchema);
  const contact = await createContact(db, input);
  return NextResponse.json(contact, { status: 201 });
});
