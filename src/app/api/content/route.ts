import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { contentPageCreateSchema } from "@/server/validation/content";
import { createContentPage, listContentPages } from "@/server/domain/content/contentService";

// Feature 051 (P7-R7): the content-pages admin API. Default-deny — content.write (Webmaster) only.
export const GET = withAuth({ requires: "content.write" }, async () => {
  return NextResponse.json({ items: await listContentPages(db) });
});

export const POST = withAuth({ requires: "content.write" }, async (req, ctx) => {
  const input = await parseBody(req, contentPageCreateSchema);
  const row = await createContentPage(db, input, ctx.staff.contactId);
  return NextResponse.json(row, { status: 201 });
});
