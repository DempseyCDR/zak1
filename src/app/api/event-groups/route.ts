import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { parseBody } from "@/server/lib/parseBody";
import { eventGroupCreateSchema } from "@/server/validation/door";
import { createEventGroup, listEventGroups } from "@/server/domain/events/eventService";

export const GET = withLogging(async () => {
  const items = await listEventGroups(db);
  return NextResponse.json({ items });
});

export const POST = withLogging(async (req) => {
  const input = await parseBody(req, eventGroupCreateSchema);
  const group = await createEventGroup(db, input);
  return NextResponse.json(group, { status: 201 });
});
