import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { gateSalesPutSchema } from "@/server/validation/door";
import { putGateSales } from "@/server/domain/door/doorRecordService";

export const PUT = withAuth<{ id: string }>({ requires: "gate.write" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, gateSalesPutSchema);
  const sales = await putGateSales(db, id, input, ctx.actor);
  return NextResponse.json({ sales });
});
