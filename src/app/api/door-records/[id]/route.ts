import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { parseBody } from "@/server/lib/parseBody";
import { doorRecordPatchSchema } from "@/server/validation/door";
import { getDoorRecord, updateDoorRecord } from "@/server/domain/door/doorRecordService";

export const GET = withLogging<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const result = await getDoorRecord(db, id);
  return NextResponse.json(result);
});

export const PATCH = withLogging<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, doorRecordPatchSchema);
  const actor = req.headers.get("x-actor") ?? "door";
  const record = await updateDoorRecord(db, id, input, actor);
  return NextResponse.json(record);
});
