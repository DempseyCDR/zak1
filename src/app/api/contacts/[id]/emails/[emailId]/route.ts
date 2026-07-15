import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { emailPatchSchema } from "@/server/validation/contacts";
import { patchEmail } from "@/server/domain/contacts/emailService";

export const PATCH = withAuth<{ id: string; emailId: string }>(async (req, ctx) => {
  const { id, emailId } = await ctx.params;
  const input = await parseBody(req, emailPatchSchema);
  const email = await patchEmail(db, id, emailId, input);
  return NextResponse.json(email);
});
