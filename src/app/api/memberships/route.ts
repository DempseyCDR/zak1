import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { membershipCreateSchema } from "@/server/validation/memberships";
import { createMembership } from "@/server/domain/membership/membershipService";

export const POST = withAuth(async (req) => {
  const input = await parseBody(req, membershipCreateSchema);
  const membership = await createMembership(db, input);
  return NextResponse.json(membership, { status: 201 });
});
