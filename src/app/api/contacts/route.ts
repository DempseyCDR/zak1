import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { contactCreateSchema } from "@/server/validation/contacts";
import {
  createContact,
  listNeedsReview,
  searchContacts,
} from "@/server/domain/contacts/contactService";

export const GET = withAuth({ requires: "base" }, async (req) => {
  const url = new URL(req.url);
  // Feature 064: the needs-review worklist rides this route via ?needsReview=1; otherwise text search.
  if (url.searchParams.get("needsReview") === "1") {
    const { items, truncated } = await listNeedsReview(db);
    return NextResponse.json({ items, truncated });
  }
  const q = url.searchParams.get("q") ?? "";
  const { items, truncated } = await searchContacts(db, q);
  return NextResponse.json({ items, truncated });
});

export const POST = withAuth({ requires: "contact.write" }, async (req) => {
  const input = await parseBody(req, contactCreateSchema);
  const contact = await createContact(db, input);
  return NextResponse.json(contact, { status: 201 });
});
