import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { assembleBookingsReport } from "@/server/domain/bookings/reportService";

// Feature 018 (B24): cross-event bookings report. `base` — any authenticated staff may read it (booking
// status/pay are not PII; the public site is separate and confirmed-only). Read-only planning view.
export const GET = withAuth({ requires: "base" }, async (req) => {
  const url = new URL(req.url);
  const p = url.searchParams;
  const report = await assembleBookingsReport(db, {
    series: p.get("series") ?? undefined,
    from: p.get("from") ?? undefined,
    to: p.get("to") ?? undefined,
    caller: p.get("caller") ?? undefined,
    band: p.get("band") ?? undefined,
    musician: p.get("musician") ?? undefined,
  });
  return NextResponse.json(report);
});
