import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { parseBody } from "@/server/lib/parseBody";
import { attendanceSchema } from "@/server/validation/attendance";
import { countAttendance, recordAttendance } from "@/server/domain/attendance/attendanceService";

export const POST = withLogging<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, attendanceSchema);
  const row = await recordAttendance(db, id, input);
  return NextResponse.json(row, { status: 201 });
});

export const GET = withLogging<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const count = await countAttendance(db, id);
  return NextResponse.json({ count });
});
