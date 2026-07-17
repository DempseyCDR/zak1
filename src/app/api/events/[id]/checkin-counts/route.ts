import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { checkinCountsSchema } from "@/server/validation/door";
import { recordCheckinCounts } from "@/server/domain/door/doorRecordService";

// Feature 017 (B29): the Door Attendant records comp + gift-card redemption COUNTS at check-in. An
// `attendance.write` capability, NOT `gate.write` — this materializes the counts on the door record
// without granting the Door Attendant any access to money (FR-018). The FS confirms/edits on /gate.
export const POST = withAuth<{ id: string }>({ requires: "attendance.write" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, checkinCountsSchema);
  const actor = req.headers.get("x-actor") ?? "door";
  const record = await recordCheckinCounts(db, id, input, actor, ctx.actor);
  return NextResponse.json(record);
});
