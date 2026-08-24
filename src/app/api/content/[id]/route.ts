import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { errors } from "@/server/lib/apiError";
import { contentPagePatchSchema } from "@/server/validation/content";
import {
  getContentPageById,
  patchContentPage,
  deleteContentPage,
} from "@/server/domain/content/contentService";

// Feature 051 (P7-R7): one content page — read (editor), edit the DRAFT, or delete. content.write only.
export const GET = withAuth<{ id: string }>({ requires: "content.write" }, async (_req, ctx) => {
  const { id } = await ctx.params;
  const row = await getContentPageById(db, id);
  if (!row) throw errors.contentPageNotFound();
  return NextResponse.json(row);
});

export const PATCH = withAuth<{ id: string }>({ requires: "content.write" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, contentPagePatchSchema);
  const row = await patchContentPage(db, id, input, ctx.staff.contactId);
  return NextResponse.json(row);
});

export const DELETE = withAuth<{ id: string }>({ requires: "content.write" }, async (_req, ctx) => {
  const { id } = await ctx.params;
  await deleteContentPage(db, id, ctx.staff.contactId);
  return NextResponse.json({ ok: true });
});
