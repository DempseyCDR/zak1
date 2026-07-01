import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withLogging } from "@/server/lib/withLogging";
import { parseBody } from "@/server/lib/parseBody";
import { miscExpenseCreateSchema } from "@/server/validation/organizer";
import { createMiscExpense, listMiscExpenses } from "@/server/domain/organizer/miscExpenseService";

export const POST = withLogging<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, miscExpenseCreateSchema);
  const row = await createMiscExpense(db, id, input);
  return NextResponse.json(row, { status: 201 });
});

export const GET = withLogging<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const view = await listMiscExpenses(db, id);
  return NextResponse.json(view);
});
