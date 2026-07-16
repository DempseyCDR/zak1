import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { bandPatchSchema } from "@/server/validation/bands";
import { archiveBand, getBand, patchBand } from "@/server/domain/bands/bandService";

export const GET = withAuth<{ id: string }>({ requires: "base" }, async (_req, ctx) => {
  const { id } = await ctx.params;
  const band = await getBand(db, id);
  return NextResponse.json(band);
});

export const PATCH = withAuth<{ id: string }>({ requires: "performer.write" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, bandPatchSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  const band = await patchBand(db, id, input, actor);
  return NextResponse.json(band);
});

export const DELETE = withAuth<{ id: string }>({ requires: "performer.write" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const actor = req.headers.get("x-actor") ?? "admin";
  await archiveBand(db, id, actor);
  return new NextResponse(null, { status: 204 });
});
