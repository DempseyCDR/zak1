import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { performerCreateSchema } from "@/server/validation/performers";
import { createPerformer, listPerformers } from "@/server/domain/performers/performerService";

export const GET = withAuth({ requires: "base" }, async () => {
  const items = await listPerformers(db);
  return NextResponse.json({ items });
});

export const POST = withAuth({ requires: "performer.write" }, async (req) => {
  const input = await parseBody(req, performerCreateSchema);
  const performer = await createPerformer(db, input);
  return NextResponse.json(performer, { status: 201 });
});
