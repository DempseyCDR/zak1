import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { nonDanceIncomeCreateSchema } from "@/server/validation/treasurer";
import {
  createNonDanceIncome,
  listNonDanceIncome,
} from "@/server/domain/treasurer/nonDanceIncomeService";

export const POST = withAuth<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, nonDanceIncomeCreateSchema);
  const row = await createNonDanceIncome(db, id, input);
  return NextResponse.json(row, { status: 201 });
});

export const GET = withAuth<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const view = await listNonDanceIncome(db, id);
  return NextResponse.json(view);
});
