import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { emailAddSchema } from "@/server/validation/contacts";
import { addEmail } from "@/server/domain/contacts/emailService";

export const POST = withAuth<{ id: string }>(
  { requires: "contact.mailing.write" },
  async (req, ctx) => {
    const { id } = await ctx.params;
    const input = await parseBody(req, emailAddSchema);
    const email = await addEmail(db, id, input);
    return NextResponse.json(email, { status: 201 });
  },
);
