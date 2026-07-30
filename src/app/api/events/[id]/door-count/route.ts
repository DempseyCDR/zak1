import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { doorCountAdjustSchema } from "@/server/validation/attendance";
import { adjustDoorCount } from "@/server/domain/door/doorRecordService";

// Feature 025 US1: nudge an event's aggregate comp / gift-card count by ±1 (counts-only, decision B). The
// Door Attendant's roster correction; the FS's gate override still supersedes for money.
export const POST = withAuth<{ id: string }>({ requires: "attendance.write" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, doorCountAdjustSchema);
  const actor = req.headers.get("x-actor") ?? "door";
  const counts = await adjustDoorCount(db, id, input.count, input.delta, actor);
  return NextResponse.json(counts);
});
