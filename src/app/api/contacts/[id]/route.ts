import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { parseBody } from "@/server/lib/parseBody";
import { contactPatchSchema } from "@/server/validation/contacts";
import { getContact, patchContact } from "@/server/domain/contacts/contactService";

export const GET = withLogging<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const contact = await getContact(db, id);
  return NextResponse.json(contact);
});

export const PATCH = withLogging<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, contactPatchSchema);
  const contact = await patchContact(db, id, input);
  return NextResponse.json(contact);
});
