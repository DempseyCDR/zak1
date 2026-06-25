import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { parseBody } from "@/server/lib/parseBody";
import { nonDanceIncomeCreateSchema } from "@/server/validation/treasurer";
import {
  createNonDanceIncome,
  listNonDanceIncome,
} from "@/server/domain/treasurer/nonDanceIncomeService";

export const POST = withLogging<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, nonDanceIncomeCreateSchema);
  const row = await createNonDanceIncome(db, id, input);
  return NextResponse.json(row, { status: 201 });
});

export const GET = withLogging<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const view = await listNonDanceIncome(db, id);
  return NextResponse.json(view);
});
