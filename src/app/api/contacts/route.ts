import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { contactCreateSchema } from "@/server/validation/contacts";
import {
  createContact,
  deriveSafeToClear,
  listNeedsReview,
  searchContacts,
} from "@/server/domain/contacts/contactService";
import { canReadPii, projectContact, recordPiiDisclosure } from "@/server/auth/pii";

export const GET = withAuth({ requires: "base" }, async (req, ctx) => {
  const url = new URL(req.url);
  // Feature 064: the needs-review worklist rides this route via ?needsReview=1; otherwise text search.
  if (url.searchParams.get("needsReview") === "1") {
    const { items, truncated } = await listNeedsReview(db);
    // Feature 069 (FR-001a) put PHONE and EMAILS on these rows — PII, on a `base` route. `projectContact`
    // is a denylist, so this is not optional: without it the review queue would hand every volunteer the
    // addresses that `GET /api/contacts/[id]` withholds from them. `safeToClear` is then re-derived from
    // what survived, so the flag describes the row this reader actually gets.
    const disclosing = canReadPii(ctx.actor);
    const rows = items.map((r) => {
      const projected = projectContact(ctx.actor, r);
      return { ...projected, safeToClear: deriveSafeToClear(projected) };
    });
    if (disclosing) {
      await recordPiiDisclosure(db, ctx.actor, "contacts.needs_review", rows.length);
    }
    return NextResponse.json({ items: rows, truncated });
  }
  const q = url.searchParams.get("q") ?? "";
  // Feature 065: the "+ archived" toggle includes archived contacts in the results (marked).
  const includeArchived = url.searchParams.get("archived") === "1";
  const { items, truncated } = await searchContacts(db, q, 20, { includeArchived });
  return NextResponse.json({ items, truncated });
});

export const POST = withAuth({ requires: "contact.write" }, async (req) => {
  const input = await parseBody(req, contactCreateSchema);
  const contact = await createContact(db, input);
  return NextResponse.json(contact, { status: 201 });
});
