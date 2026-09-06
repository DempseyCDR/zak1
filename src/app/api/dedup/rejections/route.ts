import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { rejectionSchema } from "@/server/validation/dedup";
import { rejectPair, unrejectPair } from "@/server/domain/dedup/rejectionService";

// Feature 069 (M-R18). Mel's action is "not duplicates"; the record it leaves is a REJECTION, which is
// what this resource is named for. `dedup.write` — the same capability that merges — because deciding a
// pair is not a duplicate is the same decision as deciding it is, taken the other way.
export const POST = withAuth({ requires: "dedup.write" }, async (req, ctx) => {
  const input = await parseBody(req, rejectionSchema);
  await rejectPair(db, input.contactAId, input.contactBId, ctx.staff.contactId);
  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth({ requires: "dedup.write" }, async (req, ctx) => {
  const input = await parseBody(req, rejectionSchema);
  await unrejectPair(db, input.contactAId, input.contactBId, ctx.staff.contactId);
  return NextResponse.json({ ok: true });
});
