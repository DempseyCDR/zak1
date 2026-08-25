import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { series } from "@/server/db/schema";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { admissionPricingSetSchema } from "@/server/validation/admissionPricing";
import {
  listAdmissionRevisions,
  setAdmissionPricing,
} from "@/server/domain/pricing/admissionPricingService";

// Feature 054 (P7-R10): the admission-pricing admin API. Default-deny — parameter.write (same actors who set
// staff rates); scope is enforced per-series inside setAdmissionPricing.
export const GET = withAuth({ requires: "parameter.write" }, async (req) => {
  const seriesId = new URL(req.url).searchParams.get("series");
  if (!seriesId) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "series query param required" } },
      { status: 422 },
    );
  }
  const [s] = await db
    .select({ scheduleSentence: series.scheduleSentence })
    .from(series)
    .where(eq(series.id, seriesId));
  return NextResponse.json({
    revisions: await listAdmissionRevisions(db, seriesId),
    scheduleSentence: s?.scheduleSentence ?? null,
  });
});

export const POST = withAuth({ requires: "parameter.write" }, async (req, ctx) => {
  const input = await parseBody(req, admissionPricingSetSchema);
  await setAdmissionPricing(db, input, ctx.staff.contactId, ctx.actor);
  return NextResponse.json({ ok: true }, { status: 201 });
});
