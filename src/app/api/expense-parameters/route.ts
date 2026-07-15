import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { series } from "@/server/db/schema";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { expenseParameterCreateSchema } from "@/server/validation/organizer";
import {
  createExpenseParameter,
  resolveOngoingTotalCents,
} from "@/server/domain/parameters/seriesParameterService";

export const POST = withAuth(async (req) => {
  const input = await parseBody(req, expenseParameterCreateSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  const row = await createExpenseParameter(db, input, actor);
  return NextResponse.json(row, { status: 201 });
});

export const GET = withAuth(async (req) => {
  const url = new URL(req.url);
  const seriesKey = url.searchParams.get("seriesKey");
  const kind = url.searchParams.get("kind");
  const on = url.searchParams.get("on") ?? new Date().toISOString().slice(0, 10);
  if (!seriesKey || kind !== "ongoing") {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "seriesKey and kind=ongoing required" } },
      { status: 422 },
    );
  }
  const s = await db.query.series.findFirst({ where: eq(series.key, seriesKey) });
  if (!s) return NextResponse.json({ resolved: null });
  // Sum of all ongoing charges in effect on `on` (feature 011: multiple concurrent labeled charges).
  const cents = await resolveOngoingTotalCents(db, s.id, on);
  return NextResponse.json({
    resolved:
      cents === 0 ? null : { seriesKey, kind: "ongoing", amount: cents / 100, effectiveDate: on },
  });
});
