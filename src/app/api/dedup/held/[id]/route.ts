import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { abandonHeldMerge } from "@/server/domain/dedup/heldMergeService";

/**
 * Feature 072 (FR-017): withdraw a held merge.
 *
 * Gated on `dedup.write` — the authority to merge — not on the reason's own authority. Resolving a hold
 * answers its question and needs the standing to answer it; abandoning declines to ask, changes nothing,
 * and must be available to whoever raised it. Otherwise the queue fills with items the person working it
 * cannot clear.
 */
export const DELETE = withAuth<{ id: string }>({ requires: "dedup.write" }, async (_req, ctx) => {
  const { id } = await ctx.params;
  await abandonHeldMerge(db, id, ctx.staff.contactId);
  return NextResponse.json({ ok: true });
});
