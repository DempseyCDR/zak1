import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { getMembershipStatus } from "@/server/domain/membership/membershipService";

export const GET = withLogging<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const status = await getMembershipStatus(db, id);
  return NextResponse.json(status);
});
