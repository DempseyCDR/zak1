import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { doorRecordPatchSchema } from "@/server/validation/door";
import { getDoorRecord, updateDoorRecord } from "@/server/domain/door/doorRecordService";

export const GET = withAuth<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const result = await getDoorRecord(db, id);
  return NextResponse.json(result);
});

export const PATCH = withAuth<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, doorRecordPatchSchema);
  const actor = req.headers.get("x-actor") ?? "door";
  const record = await updateDoorRecord(db, id, input, actor);
  return NextResponse.json(record);
});
