import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { assembleTreasurerReport } from "@/server/domain/treasurer/reportService";

export const GET = withLogging<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const actor = req.headers.get("x-actor") ?? "treasurer";
  const report = await assembleTreasurerReport(db, id, actor);
  return NextResponse.json(report);
});
