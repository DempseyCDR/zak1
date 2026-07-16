import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { bandCreateSchema } from "@/server/validation/bands";
import { createBand, listBands } from "@/server/domain/bands/bandService";

export const GET = withAuth({ requires: "base" }, async () => {
  const items = await listBands(db);
  return NextResponse.json({ items });
});

export const POST = withAuth({ requires: "performer.write" }, async (req) => {
  const input = await parseBody(req, bandCreateSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  const band = await createBand(db, input, actor);
  return NextResponse.json(band, { status: 201 });
});
