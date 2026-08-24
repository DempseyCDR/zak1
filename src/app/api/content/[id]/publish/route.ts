import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { publishContentPage } from "@/server/domain/content/contentService";

// Feature 051 (P7-R7): promote the draft body to the published body the public sees. content.write only.
export const POST = withAuth<{ id: string }>({ requires: "content.write" }, async (_req, ctx) => {
  const { id } = await ctx.params;
  const row = await publishContentPage(db, id, ctx.staff.contactId);
  return NextResponse.json(row);
});
