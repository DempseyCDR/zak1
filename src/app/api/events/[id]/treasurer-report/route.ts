import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { assembleTreasurerReport } from "@/server/domain/treasurer/reportService";

export const GET = withAuth<{ id: string }>({ requires: "base" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const actor = req.headers.get("x-actor") ?? "treasurer";
  const report = await assembleTreasurerReport(db, id, actor);
  return NextResponse.json(report);
});
