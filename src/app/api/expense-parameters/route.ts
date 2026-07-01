import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { series } from "@/server/db/schema";
import { withLogging } from "@/server/lib/withLogging";
import { parseBody } from "@/server/lib/parseBody";
import { expenseParameterCreateSchema } from "@/server/validation/organizer";
import {
  createExpenseParameter,
  resolveExpenseCents,
} from "@/server/domain/organizer/expenseParameterService";

export const POST = withLogging(async (req) => {
  const input = await parseBody(req, expenseParameterCreateSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  const row = await createExpenseParameter(db, input, actor);
  return NextResponse.json(row, { status: 201 });
});

export const GET = withLogging(async (req) => {
  const url = new URL(req.url);
  const seriesKey = url.searchParams.get("seriesKey");
  const kind = url.searchParams.get("kind");
  const on = url.searchParams.get("on") ?? new Date().toISOString().slice(0, 10);
  if (!seriesKey || (kind !== "rent" && kind !== "ongoing")) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "seriesKey and kind (rent|ongoing) required" } },
      { status: 422 },
    );
  }
  const s = await db.query.series.findFirst({ where: eq(series.key, seriesKey) });
  if (!s) return NextResponse.json({ resolved: null });
  const cents = await resolveExpenseCents(db, s.id, kind, on);
  return NextResponse.json({
    resolved: cents === 0 ? null : { seriesKey, kind, amount: cents / 100, effectiveDate: on },
  });
});
