import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { parseBody } from "@/server/lib/parseBody";
import { doorRecordCreateSchema } from "@/server/validation/door";
import { createDoorRecord } from "@/server/domain/door/doorRecordService";

export const POST = withLogging(async (req) => {
  const input = await parseBody(req, doorRecordCreateSchema);
  const actor = req.headers.get("x-actor") ?? "door";
  const record = await createDoorRecord(db, input.eventId, actor);
  return NextResponse.json(record, { status: 201 });
});
