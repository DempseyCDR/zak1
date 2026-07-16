import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { accountMappingPutSchema } from "@/server/validation/treasurer";
import { updateAccountMapping } from "@/server/domain/treasurer/mappingService";

export const PUT = withAuth<{ lineKey: string }>(
  { requires: "treasurer_report.write" },
  async (req, ctx) => {
    const { lineKey } = await ctx.params;
    const input = await parseBody(req, accountMappingPutSchema);
    const actor = req.headers.get("x-actor") ?? "admin";
    const row = await updateAccountMapping(db, lineKey, input, actor);
    return NextResponse.json(row);
  },
);
