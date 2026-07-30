import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { attendancePatchSchema } from "@/server/validation/attendance";
import {
  deleteAttendance,
  moveAttendance,
  patchAttendance,
} from "@/server/domain/attendance/attendanceService";

// Feature 025 US1: correct one attendance record. A body with `eventId` is a move to a same-group sibling
// (server-validated); otherwise the other fields (children / reassign / open-band) are applied.
export const PATCH = withAuth<{ id: string }>(
  { requires: "attendance.write" },
  async (req, ctx) => {
    const { id } = await ctx.params;
    const input = await parseBody(req, attendancePatchSchema);
    const actor = req.headers.get("x-actor") ?? "door";
    const { eventId, ...fields } = input;
    let result = eventId ? await moveAttendance(db, id, eventId, actor) : null;
    if (Object.keys(fields).length > 0) result = await patchAttendance(db, id, fields, actor);
    return NextResponse.json(result);
  },
);

export const DELETE = withAuth<{ id: string }>(
  { requires: "attendance.write" },
  async (req, ctx) => {
    const { id } = await ctx.params;
    const actor = req.headers.get("x-actor") ?? "door";
    await deleteAttendance(db, id, actor);
    return NextResponse.json({ ok: true });
  },
);
