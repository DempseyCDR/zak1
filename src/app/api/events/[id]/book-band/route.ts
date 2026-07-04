import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { parseBody } from "@/server/lib/parseBody";
import { bookBandSchema } from "@/server/validation/bands";
import { bookBand } from "@/server/domain/bands/bookBand";

export const POST = withLogging<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, bookBandSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  const result = await bookBand(db, id, input.bandId, input.memberPay ?? [], actor);
  return NextResponse.json(result, { status: 201 });
});
