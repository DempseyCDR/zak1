import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { getMembershipStatus } from "@/server/domain/membership/membershipService";

export const GET = withAuth<{ id: string }>({ requires: "base" }, async (_req, ctx) => {
  const { id } = await ctx.params;
  const status = await getMembershipStatus(db, id);
  return NextResponse.json(status);
});
