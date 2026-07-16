import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { attendanceSchema } from "@/server/validation/attendance";
import {
  listEventAttendance,
  recordAttendance,
} from "@/server/domain/attendance/attendanceService";

export const POST = withAuth<{ id: string }>({ requires: "attendance.write" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, attendanceSchema);
  const row = await recordAttendance(db, id, input);
  return NextResponse.json(row, { status: 201 });
});

export const GET = withAuth<{ id: string }>({ requires: "base" }, async (_req, ctx) => {
  const { id } = await ctx.params;
  const view = await listEventAttendance(db, id);
  return NextResponse.json(view);
});
