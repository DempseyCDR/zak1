import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { actorCan } from "@/server/auth/can";
import { errors } from "@/server/lib/apiError";
import { parseBody } from "@/server/lib/parseBody";
import { heldResolveSchema } from "@/server/validation/dedup";
import {
  authorityFor,
  getHeldMerge,
  resolveHeldMerge,
} from "@/server/domain/dedup/heldMergeService";

/**
 * Feature 069 (FR-012/FR-013). The authority follows the REASON, not the route: choosing which sign-in
 * identity survives is a role decision (`role.assign` — VP, President, Super-user), while choosing which
 * membership account survives is ordinary duplicate work. So the route requires the capability every
 * holder shares, then checks the reason's own authority once the hold is loaded — which is the earliest
 * point at which the required authority is known.
 */
export const POST = withAuth<{ id: string }>({ requires: "dedup.write" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, heldResolveSchema);
  const hold = await getHeldMerge(db, id);

  const required = authorityFor(hold.reason);
  if (!actorCan(ctx.actor, required)) throw errors.unauthorized(required);

  const outcome = await resolveHeldMerge(db, id, input, ctx.staff.contactId);
  return NextResponse.json(outcome);
});
