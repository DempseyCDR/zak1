import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { eventCreateSchema } from "@/server/validation/door";
import { createEvent, listEvents } from "@/server/domain/events/eventService";

export const GET = withAuth(async (req) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const items = await listEvents(db, from, to);
  return NextResponse.json({ items });
});

export const POST = withAuth(async (req) => {
  const input = await parseBody(req, eventCreateSchema);
  const event = await createEvent(db, input);
  return NextResponse.json(event, { status: 201 });
});
