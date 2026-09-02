import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { archiveContact } from "@/server/domain/contacts/contactService";

// Feature 065 (M-R9): archive a contact — a reversible retirement that hides it from every active read.
// Rides on contact.write (the maintainer's grant); reversed by POST …/restore.
export const POST = withAuth<{ id: string }>({ requires: "contact.write" }, async (_req, ctx) => {
  const { id } = await ctx.params;
  const contact = await archiveContact(db, id);
  return NextResponse.json(contact);
});
