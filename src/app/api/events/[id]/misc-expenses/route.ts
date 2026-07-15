import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { miscExpenseCreateSchema } from "@/server/validation/organizer";
import { createMiscExpense, listMiscExpenses } from "@/server/domain/organizer/miscExpenseService";

export const POST = withAuth<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, miscExpenseCreateSchema);
  const row = await createMiscExpense(db, id, input);
  return NextResponse.json(row, { status: 201 });
});

export const GET = withAuth<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const view = await listMiscExpenses(db, id);
  return NextResponse.json(view);
});
