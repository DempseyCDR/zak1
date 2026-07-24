import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { linkParkedNotification } from "@/server/domain/paypal/captureService";

const linkSchema = z.object({ contactId: z.string().uuid() });

// Feature 019 US3 (FR-011): manually link a parked notification to a contact and enroll the membership —
// the same shared creation path, so an admin-linked payment is identical to an auto-matched one.
export const POST = withAuth<{ id: string }>({ requires: "membership.write" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const { contactId } = await parseBody(req, linkSchema);
  const actor = req.headers.get("x-actor") ?? "admin";
  await linkParkedNotification(db, id, contactId, actor);
  return NextResponse.json({ ok: true });
});
