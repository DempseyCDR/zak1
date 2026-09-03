import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { emailPatchSchema } from "@/server/validation/contacts";
import { deleteEmail, patchEmail } from "@/server/domain/contacts/emailService";

export const PATCH = withAuth<{ id: string; emailId: string }>(
  { requires: "contact.mailing.write" },
  async (req, ctx) => {
    const { id, emailId } = await ctx.params;
    const input = await parseBody(req, emailPatchSchema);
    const email = await patchEmail(db, id, emailId, input);
    return NextResponse.json(email);
  },
);

// Feature 066 (M-R17): permanently erase an email row. Gated by the super-user's unrestricted-erasure
// capability (reused from 065 — no new capability). Soft "remove" is a status=inactive PATCH.
export const DELETE = withAuth<{ id: string; emailId: string }>(
  { requires: "contact.delete.unrestricted" },
  async (_req, ctx) => {
    const { id, emailId } = await ctx.params;
    await deleteEmail(db, id, emailId, ctx.staff.contactId);
    return NextResponse.json({ ok: true });
  },
);
