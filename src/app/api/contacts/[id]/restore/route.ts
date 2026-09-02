import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { restoreContact } from "@/server/domain/contacts/contactService";

// Feature 065 (M-R9): restore (unarchive) a contact — returns it to active use. Contact.write, the
// inverse of archive.
export const POST = withAuth<{ id: string }>({ requires: "contact.write" }, async (_req, ctx) => {
  const { id } = await ctx.params;
  const contact = await restoreContact(db, id);
  return NextResponse.json(contact);
});
