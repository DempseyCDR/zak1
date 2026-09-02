import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { markReviewed } from "@/server/domain/contacts/contactService";

// Feature 064 (FR-013): the manual "Mark reviewed" override — clear `needs_review` for a contact we
// judge unlikely to ever provide the required data. Requires contact.write (the maintainer's grant).
export const POST = withAuth<{ id: string }>({ requires: "contact.write" }, async (_req, ctx) => {
  const { id } = await ctx.params;
  const contact = await markReviewed(db, id);
  return NextResponse.json(contact);
});
