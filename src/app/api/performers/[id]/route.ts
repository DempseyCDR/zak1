import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { performerPatchSchema } from "@/server/validation/performers";
import { getPerformer, patchPerformer } from "@/server/domain/performers/performerService";

export const GET = withAuth<{ id: string }>({ requires: "base" }, async (_req, ctx) => {
  const { id } = await ctx.params;
  const performer = await getPerformer(db, id);
  return NextResponse.json(performer);
});

export const PATCH = withAuth<{ id: string }>({ requires: "performer.write" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, performerPatchSchema);
  const performer = await patchPerformer(db, id, input);
  return NextResponse.json(performer);
});
