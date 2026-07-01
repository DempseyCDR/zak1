import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { assembleOrganizerReport } from "@/server/domain/organizer/reportService";

export const GET = withLogging<{ seriesKey: string }>(async (req, ctx) => {
  const { seriesKey } = await ctx.params;
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year")) || new Date().getUTCFullYear();
  const report = await assembleOrganizerReport(db, seriesKey, year);
  return NextResponse.json(report);
});
