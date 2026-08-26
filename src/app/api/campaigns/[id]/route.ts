import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { withAuth } from "@/server/auth/withAuth";
import { parseBody } from "@/server/lib/parseBody";
import { errors } from "@/server/lib/apiError";
import { campaignSchema } from "@/server/validation/campaign";
import { deleteCampaign, updateCampaign } from "@/server/domain/campaigns/campaignService";

// Feature 057 (P7-R14): one campaign — edit or remove. content.write only.
export const PATCH = withAuth<{ id: string }>({ requires: "content.write" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, campaignSchema);
  const ok = await updateCampaign(db, id, input, ctx.staff.contactId);
  if (!ok) throw errors.campaignNotFound();
  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth<{ id: string }>({ requires: "content.write" }, async (_req, ctx) => {
  const { id } = await ctx.params;
  await deleteCampaign(db, id, ctx.staff.contactId);
  return NextResponse.json({ ok: true });
});
