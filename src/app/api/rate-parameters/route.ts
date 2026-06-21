import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { parseBody } from "@/server/lib/parseBody";
import { rateParameterCreateSchema } from "@/server/validation/performers";
import { createRateParameter, resolveRate } from "@/server/domain/bookings/rateParameterService";

export const POST = withLogging(async (req) => {
  const input = await parseBody(req, rateParameterCreateSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  const row = await createRateParameter(db, input, actor);
  return NextResponse.json(row, { status: 201 });
});

export const GET = withLogging(async (req) => {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const on = url.searchParams.get("on");
  if (kind !== "caller" && kind !== "sound_tech") {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "kind must be caller|sound_tech" } },
      { status: 422 },
    );
  }
  const onDate = on ?? new Date().toISOString().slice(0, 10);
  const resolved = await resolveRate(db, kind, onDate);
  return NextResponse.json({ resolved });
});
