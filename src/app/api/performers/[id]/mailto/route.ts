import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { getPerformerMailtoEmail } from "@/server/domain/performers/performerService";

// Feature 020 US2 (FR-011): the performer's mailto email is PII → gated by contact.pii.read (the Booker
// holds it). Returns { email: string | null }; null → the modal shows no mailto link.
export const GET = withAuth<{ id: string }>({ requires: "contact.pii.read" }, async (_req, ctx) => {
  const { id } = await ctx.params;
  const email = await getPerformerMailtoEmail(db, id);
  return NextResponse.json({ email });
});
