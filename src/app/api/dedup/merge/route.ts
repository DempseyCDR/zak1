import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { mergeSchema } from "@/server/validation/dedup";
import { mergeContacts } from "@/server/domain/dedup/mergeService";

export const POST = withAuth({ requires: "dedup.write" }, async (req) => {
  const input = await parseBody(req, mergeSchema);
  // Phase 1 has no auth; actor is supplied via a header until login lands.
  const actor = req.headers.get("x-actor") ?? "admin";
  const result = await mergeContacts(db, input.canonicalId, input.mergedId, actor);
  return NextResponse.json(result);
});
