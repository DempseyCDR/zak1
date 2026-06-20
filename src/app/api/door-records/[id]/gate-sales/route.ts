import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { parseBody } from "@/server/lib/parseBody";
import { gateSalesPutSchema } from "@/server/validation/door";
import { putGateSales } from "@/server/domain/door/doorRecordService";

export const PUT = withLogging<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, gateSalesPutSchema);
  const sales = await putGateSales(db, id, input);
  return NextResponse.json({ sales });
});
