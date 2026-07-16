import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { assembleOrganizerReport } from "@/server/domain/organizer/reportService";

export const GET = withAuth<{ seriesKey: string }>({ requires: "base" }, async (req, ctx) => {
  const { seriesKey } = await ctx.params;
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year")) || new Date().getUTCFullYear();
  const report = await assembleOrganizerReport(db, seriesKey, year);
  return NextResponse.json(report);
});
