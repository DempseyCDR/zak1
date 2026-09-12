import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { actorCan } from "@/server/auth/can";
import { undoMerge } from "@/server/domain/dedup/undoMergeService";

/**
 * Feature 074 (FR-023 to FR-025). Reverse a completed merge.
 *
 * `dedup.write` — whoever can merge can unmerge. Undo SEPARATES two records that were wrongly joined,
 * which is the safe direction, so it needs no more authority than the merge did.
 *
 * The one exception is not a second gate on this route. Restoring sign-in GRANTS access, so it needs
 * `role.assign` — but lacking it never refuses the request: those entries are skipped and reported in
 * the 200 (FR-025). Refusing the whole reversal over the one part that repairs itself on the next
 * sign-in would be the wrong trade, so the capability is passed to the service as a fact about the
 * actor rather than enforced here.
 */
export const POST = withAuth<{ id: string }>({ requires: "dedup.write" }, async (_req, ctx) => {
  const { id } = await ctx.params;

  const outcome = await undoMerge(db, id, ctx.staff.contactId, {
    canAssignRoles: actorCan(ctx.actor, "role.assign"),
  });

  // A 200 carrying a non-empty `skipped` is still a success: the reversal committed. The client must
  // not render it as wholly clean — see FR-018 and the contract.
  return NextResponse.json(outcome);
});
