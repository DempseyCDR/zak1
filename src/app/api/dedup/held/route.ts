import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { listHeldMerges } from "@/server/domain/dedup/heldMergeService";

// Feature 069 (FR-014): held merges feed the needs-review queue, which therefore renders two kinds of
// task. `dedup.write` to SEE one — Mel can see it, and can see it is not hers to finish; resolving it is
// gated separately, by the authority the hold's reason demands.
export const GET = withAuth({ requires: "dedup.write" }, async () => {
  return NextResponse.json({ held: await listHeldMerges(db) });
});
