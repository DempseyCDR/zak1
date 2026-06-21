import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { parseBody } from "@/server/lib/parseBody";
import { performerPatchSchema } from "@/server/validation/performers";
import { getPerformer, patchPerformer } from "@/server/domain/performers/performerService";

export const GET = withLogging<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const performer = await getPerformer(db, id);
  return NextResponse.json(performer);
});

export const PATCH = withLogging<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, performerPatchSchema);
  const performer = await patchPerformer(db, id, input);
  return NextResponse.json(performer);
});
