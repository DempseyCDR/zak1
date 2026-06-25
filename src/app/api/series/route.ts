import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { listSeries } from "@/server/domain/events/eventService";

export const GET = withLogging(async () => {
  const items = await listSeries(db);
  return NextResponse.json({ items });
});
