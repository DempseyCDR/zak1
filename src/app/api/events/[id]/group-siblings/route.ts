import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { getGroupSiblings } from "@/server/domain/events/eventService";

// Feature 025 US1: the same-group sibling events — the valid targets for a roster move. Empty when ungrouped.
export const GET = withAuth<{ id: string }>({ requires: "attendance.write" }, async (_req, ctx) => {
  const { id } = await ctx.params;
  const items = await getGroupSiblings(db, id);
  return NextResponse.json({ items });
});
