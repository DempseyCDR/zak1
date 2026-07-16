import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { seriesQboPutSchema } from "@/server/validation/treasurer";
import { updateSeriesQbo } from "@/server/domain/treasurer/mappingService";

export const PUT = withAuth<{ seriesId: string }>(
  { requires: "treasurer_report.write" },
  async (req, ctx) => {
    const { seriesId } = await ctx.params;
    const input = await parseBody(req, seriesQboPutSchema);
    const actor = req.headers.get("x-actor") ?? "admin";
    const row = await updateSeriesQbo(db, seriesId, input, actor);
    return NextResponse.json(row);
  },
);
