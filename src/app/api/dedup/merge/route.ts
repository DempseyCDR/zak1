import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { mergeSchema } from "@/server/validation/dedup";
import { mergeContacts } from "@/server/domain/dedup/mergeService";
import { actorCan } from "@/server/auth/can";
import { errors } from "@/server/lib/apiError";

export const POST = withAuth({ requires: "dedup.write" }, async (req, ctx) => {
  const input = await parseBody(req, mergeSchema);
  // Feature 069 (FR-012): choosing which sign-in identity survives is a ROLE decision, not a duplicate
  // one — the person working the queue is not necessarily the person who may make it.
  if (input.survivingLoginEmailId && !actorCan(ctx.actor, "role.assign")) {
    throw errors.unauthorized("role.assign");
  }
  // The outcome is discriminated (`completed` / `held`): a merge that cannot complete is HELD with
  // nothing written, rather than surfacing a raw unique-violation from the database.
  const outcome = await mergeContacts(db, input.canonicalId, input.mergedId, ctx.staff.contactId, {
    ...(input.survivingLoginEmailId ? { survivingLoginEmailId: input.survivingLoginEmailId } : {}),
  });
  return NextResponse.json(outcome);
});
