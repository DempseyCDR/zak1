import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { scheduleSentenceSchema } from "@/server/validation/admissionPricing";
import { setScheduleSentence } from "@/server/domain/pricing/admissionPricingService";

// Feature 054 (P7-R10): set/clear a series' curated standing-schedule sentence. parameter.write; per-series scope.
export const POST = withAuth({ requires: "parameter.write" }, async (req, ctx) => {
  const input = await parseBody(req, scheduleSentenceSchema);
  await setScheduleSentence(db, input.seriesId, input.sentence, ctx.staff.contactId, ctx.actor);
  return NextResponse.json({ ok: true });
});
