import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { parseBody } from "@/server/lib/parseBody";
import { performerCreateSchema } from "@/server/validation/performers";
import { createPerformer, listPerformers } from "@/server/domain/performers/performerService";

export const GET = withLogging(async () => {
  const items = await listPerformers(db);
  return NextResponse.json({ items });
});

export const POST = withLogging(async (req) => {
  const input = await parseBody(req, performerCreateSchema);
  const performer = await createPerformer(db, input);
  return NextResponse.json(performer, { status: 201 });
});
