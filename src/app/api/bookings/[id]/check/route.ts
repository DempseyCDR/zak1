import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { bookings } from "@/server/db/schema";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { errors } from "@/server/lib/apiError";
import { checkNumberPatchSchema } from "@/server/validation/treasurer";

export const PATCH = withAuth<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, checkNumberPatchSchema);
  const [row] = await db
    .update(bookings)
    .set({ checkNumber: input.checkNumber, updatedAt: new Date() })
    .where(eq(bookings.id, id))
    .returning();
  if (!row) throw errors.bookingNotFound();
  return NextResponse.json(row);
});
