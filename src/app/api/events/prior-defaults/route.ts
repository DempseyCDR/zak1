import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { series } from "@/server/db/schema";
import { withAuth } from "@/server/auth/withAuth";
import { priorEventDefaults } from "@/server/domain/events/eventService";

// Feature 020 US4 (FR-018): venue + start time to pre-fill a NEW event, from the series' latest prior event.
export const GET = withAuth({ requires: "base" }, async (req) => {
  const p = new URL(req.url).searchParams;
  const seriesKey = p.get("seriesKey");
  const before = p.get("before");
  if (!seriesKey || !before) {
    return NextResponse.json({ venueId: null, startTime: null });
  }
  const s = await db.query.series.findFirst({ where: eq(series.key, seriesKey) });
  if (!s) return NextResponse.json({ venueId: null, startTime: null });
  return NextResponse.json(await priorEventDefaults(db, s.id, before));
});
