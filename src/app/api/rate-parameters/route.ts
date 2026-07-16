import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { series } from "@/server/db/schema";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { rateParameterCreateSchema } from "@/server/validation/performers";
import {
  createRateParameter,
  resolveParameterCents,
} from "@/server/domain/parameters/seriesParameterService";

export const POST = withAuth({ requires: "parameter.write" }, async (req, ctx) => {
  const input = await parseBody(req, rateParameterCreateSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  const row = await createRateParameter(db, input, actor, ctx.actor);
  return NextResponse.json(row, { status: 201 });
});

export const GET = withAuth({ requires: "base" }, async (req) => {
  const url = new URL(req.url);
  const seriesKey = url.searchParams.get("seriesKey");
  const kind = url.searchParams.get("kind");
  const on = url.searchParams.get("on") ?? new Date().toISOString().slice(0, 10);
  if (!seriesKey || (kind !== "caller" && kind !== "sound_tech" && kind !== "musician")) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "seriesKey and kind (caller|sound_tech|musician) required",
        },
      },
      { status: 422 },
    );
  }
  const s = await db.query.series.findFirst({ where: eq(series.key, seriesKey) });
  if (!s) return NextResponse.json({ resolved: null });
  const cents = await resolveParameterCents(db, {
    category: "rate",
    kind,
    seriesId: s.id,
    onDate: on,
  });
  return NextResponse.json({
    resolved: cents === 0 ? null : { seriesKey, kind, amount: cents / 100, effectiveDate: on },
  });
});
