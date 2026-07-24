import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { series } from "@/server/db/schema";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { doorParameterCreateSchema } from "@/server/validation/door";
import {
  createDoorParameter,
  resolveParameterCentsOrNull,
} from "@/server/domain/parameters/seriesParameterService";

// Feature 019 US5 (FR-021/FR-026): the per-series seed float — set gated by parameter.write, read by base.
export const POST = withAuth({ requires: "parameter.write" }, async (req, ctx) => {
  const input = await parseBody(req, doorParameterCreateSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  const row = await createDoorParameter(db, input, actor, ctx.actor);
  return NextResponse.json(row, { status: 201 });
});

export const GET = withAuth({ requires: "base" }, async (req) => {
  const url = new URL(req.url);
  const seriesKey = url.searchParams.get("seriesKey");
  const on = url.searchParams.get("on") ?? new Date().toISOString().slice(0, 10);
  if (!seriesKey) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "seriesKey required" } },
      { status: 422 },
    );
  }
  const s = await db.query.series.findFirst({ where: eq(series.key, seriesKey) });
  if (!s) return NextResponse.json({ resolved: null });
  const cents = await resolveParameterCentsOrNull(db, {
    category: "door",
    kind: "seed_float",
    seriesId: s.id,
    onDate: on,
  });
  return NextResponse.json({
    resolved: cents === null ? null : { seriesKey, amount: cents / 100, effectiveDate: on },
  });
});
