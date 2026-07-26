import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { series } from "@/server/db/schema";
import { withAuth } from "@/server/auth/withAuth";
import { resolveRentForVenue } from "@/server/domain/parameters/rentService";

// Feature 020 US4 (FR-019): the resolved rent default for a chosen (series, venue, date) — the modal shows
// this and re-computes it when the venue changes, before saving.
export const GET = withAuth({ requires: "base" }, async (req) => {
  const p = new URL(req.url).searchParams;
  const seriesKey = p.get("seriesKey");
  const venueId = p.get("venueId");
  const date = p.get("date") ?? new Date().toISOString().slice(0, 10);
  if (!seriesKey) return NextResponse.json({ rentCents: 0 });
  const s = await db.query.series.findFirst({ where: eq(series.key, seriesKey) });
  if (!s) return NextResponse.json({ rentCents: 0 });
  return NextResponse.json({ rentCents: await resolveRentForVenue(db, s.id, venueId, date) });
});
