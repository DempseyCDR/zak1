import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { ensureDoorRecord, getDoorRecord } from "@/server/domain/door/doorRecordService";

// Idempotent "open the door record" for an event: create if absent, else fetch (FR-015).
export const POST = withAuth<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const actor = req.headers.get("x-actor") ?? "door";
  const row = await ensureDoorRecord(db, id, actor);
  const result = await getDoorRecord(db, row.id);
  return NextResponse.json(result);
});
