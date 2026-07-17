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

export const GET = withAuth<{ id: string }>({ requires: "base" }, async (req, ctx) => {
  const { id } = await ctx.params;
  // B33: roster sort by first or last name (default last).
  const sort = new URL(req.url).searchParams.get("sort") === "first" ? "first" : "last";
  const view = await listEventAttendance(db, id, sort);
  return NextResponse.json(view);
});
