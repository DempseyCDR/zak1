import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { listSeries } from "@/server/domain/events/eventService";

export const GET = withAuth({ requires: "base" }, async () => {
  const items = await listSeries(db);
  return NextResponse.json({ items });
});
